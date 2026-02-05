import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseEther, encodeFunctionData, toHex } from "viem";
import { unichainSepolia } from "viem/chains";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";
import { privy } from "@/lib/privy";

// Constants
const UNIVERSAL_ROUTER = process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS as `0x${string}`;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const CHAIN_ID = 1301;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as const;

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

const UNIVERSAL_ROUTER_ABI = [
    {
        name: "execute",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "commands", type: "bytes" },
            { name: "inputs", type: "bytes[]" },
            { name: "deadline", type: "uint256" }
        ],
        outputs: []
    }
] as const;

export async function POST(request: NextRequest) {
    try {
        const { direction, amount, privyUserId } = await request.json();

        console.log(`[Swap API] Request received. Direction: ${direction}, Amount: ${amount}, UserID: ${privyUserId}`);

        if (!privyUserId) {
            return NextResponse.json({ error: "Missing privyUserId for secure wallet lookup" }, { status: 400 });
        }

        // 1. Get user's Privy embedded wallet
        const user = await privy.getUser(privyUserId);
        const wallet = user.linkedAccounts?.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy'
        ) as any;

        if (!wallet) {
            console.error(`[Swap API] User ${privyUserId} has no embedded wallet.`);
            return NextResponse.json(
                { error: 'User has no embedded wallet. Please create one in the sidebar.' },
                { status: 404 }
            );
        }

        console.log(`[Swap API] Using user's embedded wallet: ${wallet.address}`);

        // 2. Setup V4 Swap (ETH -> EWT)
        if (direction !== "eth_to_ewt") {
            return NextResponse.json({ error: "Currently only ETH -> EWT swaps are supported via this route" }, { status: 400 });
        }

        const amountWei = parseEther(amount.toString());

        // Pool key - MUST match exactly how the pool was initialized
        // Pool key - Updated for SurgeHook with Dynamic Fees
        const poolKey = {
            currency0: NATIVE_ETH,
            currency1: EWT_ADDRESS,
            fee: 0x800000,          // Dynamic fee flag (0x800000)
            tickSpacing: 60,
            hooks: process.env.NEXT_PUBLIC_SURGE_HOOK_ADDRESS as `0x${string}`,
        };

        // Build V4 swap using the SDK
        const v4Planner = new V4Planner();
        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [{
            poolKey,
            zeroForOne: true,
            amountIn: amountWei.toString(),
            amountOutMinimum: "0",
            hookData: "0x",  // Empty hook data
        }]);
        v4Planner.addAction(Actions.SETTLE_ALL, [NATIVE_ETH, amountWei.toString()]);
        v4Planner.addAction(Actions.TAKE_ALL, [EWT_ADDRESS, "0"]);

        const routePlanner = new RoutePlanner();
        routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
        const encodedActions = v4Planner.finalize();

        const block = await publicClient.getBlock();
        const deadline = block.timestamp + 3600n;

        // 3. Balance Check
        const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
        if (balance < amountWei) {
            return NextResponse.json({
                error: "Insufficient ETH in your embedded wallet",
                balance: balance.toString(),
                needed: amountWei.toString(),
                address: wallet.address
            }, { status: 400 });
        }

        // 4. Encode calldata for Universal Router
        const calldata = encodeFunctionData({
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: 'execute',
            args: [routePlanner.commands as `0x${string}`, [encodedActions as `0x${string}`], deadline]
        });

        // 5. Execute via Privy - signs with USER's embedded wallet
        console.log(`[Swap API] Executing swap from user wallet: ${wallet.address}`);
        console.log(`[Swap API] Pool Key:`, poolKey);
        console.log(`[Swap API] Amount:`, amountWei.toString());

        const txReceipt = await privy.walletApi.ethereum.sendTransaction({
            walletId: wallet.id,
            caip2: `eip155:${CHAIN_ID}`,
            transaction: {
                to: UNIVERSAL_ROUTER,
                data: calldata,
                value: toHex(amountWei),
                chainId: CHAIN_ID,
            }
        });

        console.log(`[Swap API] Success! Hash: ${txReceipt.hash}`);

        return NextResponse.json({
            success: true,
            txHash: txReceipt.hash,
            wallet: wallet.address
        });

    } catch (error: any) {
        console.error("Swap API Error:", error);
        return NextResponse.json({
            error: error.message || "Swap execution failed",
            details: error.shortMessage
        }, { status: 500 });
    }
}
