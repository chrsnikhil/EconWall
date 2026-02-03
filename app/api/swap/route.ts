import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "viem/chains";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";
import { Ether, Token, Currency } from "@uniswap/sdk-core";
import { BigNumber } from "@ethersproject/bignumber";

// Constants
// Force Rebuild
const UNIVERSAL_ROUTER = process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS as `0x${string}`;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const EWT_ADDRESS_STR = EWT_ADDRESS; // Case sensitive checksum if needed, handled by .env
const CHAIN_ID = 1301;
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_WALLET_FACTORY_ADDRESS as `0x${string}`;

// Addresses must be strings for Encoding actions
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Clients
const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
    account,
    chain: unichainSepolia,
    transport: http(),
});

// ABI
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

export async function GET() {
    return NextResponse.json({ status: "Swap API Ready (EOA Mode)" });
}

export async function POST(request: NextRequest) {
    try {
        const { direction, amount, sender } = await request.json(); // sender = User EOA
        console.log(`[EOA Swap] ${direction} ${amount} (Requested by ${sender || "Unknown"})`);

        // 1. Setup Tokens
        const isEthToEwt = direction === "eth_to_ewt";
        const ETH_TOKEN = Ether.onChain(CHAIN_ID);
        const EWT_TOKEN = new Token(CHAIN_ID, EWT_ADDRESS_STR, 18, 'EWT', 'EconWall Token');

        const amountWei = isEthToEwt ? parseEther(amount.toString()) : 0n;

        if (!isEthToEwt) return NextResponse.json({ error: "Only ETH -> EWT supported" }, { status: 400 });

        // 2. Pool Key
        const poolKey = {
            currency0: NATIVE_ETH,
            currency1: EWT_ADDRESS_STR,
            fee: 3000,
            tickSpacing: 100,
            hooks: NATIVE_ETH,
        };

        // 3. V4 Planner
        const v4Planner = new V4Planner();
        const amountBn = BigNumber.from(amountWei.toString());

        // 3.1 Swap
        const swapConfig = {
            poolKey,
            zeroForOne: true,
            amountIn: amountWei.toString(),
            amountOutMinimum: "0",
            hookData: "0x",
        };
        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);

        // 3.2 Settle (ETH)
        v4Planner.addAction(Actions.SETTLE_ALL, [NATIVE_ETH, amountWei.toString()]);

        // 3.3 Take (EWT) -> Server Wallet
        v4Planner.addAction(Actions.TAKE_ALL, [EWT_ADDRESS_STR, "0"]);

        // 4. Encode
        const routePlanner = new RoutePlanner();
        routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
        const encodedActions = v4Planner.finalize();
        const inputs = [encodedActions];
        const deadline = Math.floor(Date.now() / 1000) + 1800;

        console.log(`[EOA Swap] Executing...`);

        // 5. Execute
        const txHash = await walletClient.writeContract({
            address: UNIVERSAL_ROUTER,
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: "execute",
            args: [routePlanner.commands, inputs, BigInt(deadline)],
            value: amountWei,
        });

        console.log(`[EOA Swap] TX: ${txHash}`);
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // 6. FORWARD TO USER EOA (Direct)
        let transferHash = null;
        let forwardedTo = null;

        if (sender) {
            console.log(`[Forwarding] to User EOA: ${sender}`);
            forwardedTo = sender;

            // Transfer ABI
            const ERC20_TRANSFER = [{
                name: 'transfer',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                outputs: [{ name: '', type: 'bool' }]
            }];

            // Get Server Balance
            const balance = await publicClient.readContract({
                address: EWT_ADDRESS_STR,
                abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
                functionName: 'balanceOf',
                args: [account.address]
            }) as bigint;

            if (balance > 0n) {
                transferHash = await walletClient.writeContract({
                    address: EWT_ADDRESS_STR,
                    abi: ERC20_TRANSFER,
                    functionName: 'transfer',
                    args: [sender as `0x${string}`, balance], // Send to EOA
                });
                console.log(`[Forwarding] Transfer TX: ${transferHash}`);
                await publicClient.waitForTransactionReceipt({ hash: transferHash });
            }
        } else {
            console.log(`[Forwarding] No Sender provided`);
        }

        return NextResponse.json({
            success: true,
            txHash,
            transferHash,
            forwardedTo,
            message: forwardedTo ? "Swap & Forward Successful" : "Swap Successful (Held in Server)"
        });

    } catch (error: any) {
        console.error("Swap Error:", error);
        return NextResponse.json({
            error: error.message || "Swap failed",
            details: error.revertErrorName || error.shortMessage
        }, { status: 500 });
    }
}
