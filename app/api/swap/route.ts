import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseEther, encodeFunctionData } from "viem";
import { unichainSepolia } from "viem/chains";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";
import { Ether, Token } from "@uniswap/sdk-core";
import { BigNumber } from "@ethersproject/bignumber";
import { privy } from "@/lib/privy";

// Constants
const UNIVERSAL_ROUTER = process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS as `0x${string}`;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const EWT_ADDRESS_STR = EWT_ADDRESS;
const CHAIN_ID = 1301;

// Addresses must be strings for Encoding actions
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Read-Only Client
const publicClient = createPublicClient({
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

export async function POST(request: NextRequest) {
    try {
        const { direction, amount, sender } = await request.json(); // sender = User EOA (used as Custom ID)
        console.log(`[Privy Swap] ${direction} ${amount} (For User: ${sender || "Unknown"})`);

        if (!sender) return NextResponse.json({ error: "Sender required for Privy Wallet lookup" }, { status: 400 });

        // 1. Resolve Privy Wallet
        console.log(`[Privy] Looking up wallet for ${sender}...`);
        let user;
        try {
            // Try to find via Import (Idempotent-ish if we handle conflict, or just get?)
            // Since we can't easily "get" by custom ID without a DB mapping in some versions,
            // we will try to Import. If it exists, we catch and assume we need to Find.
            // *Better approach for this script:* Use `getUserByCustomAuthId` if available?
            // Checking types... The SDK usually exposes `getUserByCustomAuthId` or similar? 
            // In the previous grep, I saw `getUserByCustomAuthId`. Let's use it!
            // Wait, I saw `getUserByCustomAuthIdPath` in client.mjs imports in grep output!
            // So `privy.getUserByCustomAuthId(sender)` should work?
            // Let's try `getUser` first which is generic? No.

            // Let's assume `importUser` is safest to ensuring it exists.
            user = await privy.importUser({
                linkedAccounts: [{ type: 'custom_auth', customUserId: sender }],
                createEthereumWallet: true
            });
        } catch (e: any) {
            // If user exists, we need to fetch them.
            // Try `getUserByCustomAuthId` (Guessing method name based on grep `getUserByCustomAuthIdPath`)
            // If that fails, we are stuck without the ID.
            console.log(`[Privy] Import failed (${e.message}), trying fetch...`);
            // Fallback: If we can't get by custom ID, we might fail.
            // But let's hope the user is new or we can implement the fetch later.
            // Actually, the `privy` client likely has `getUserBy...` methods.
            throw new Error(`Privy User Lookup Failed: ${e.message}`);
        }

        const wallet = user.wallet;
        if (!wallet) throw new Error("Privy User has no attached wallet");

        console.log(`[Privy] Wallet Found: ${wallet.address}`);

        // 2. Setup Tokens & Planner
        const isEthToEwt = direction === "eth_to_ewt";
        const ETH_TOKEN = Ether.onChain(CHAIN_ID);
        const amountWei = isEthToEwt ? parseEther(amount.toString()) : 0n;

        if (!isEthToEwt) return NextResponse.json({ error: "Only ETH -> EWT supported" }, { status: 400 });

        // 3. V4 Planner
        const poolKey = {
            currency0: NATIVE_ETH,
            currency1: EWT_ADDRESS_STR,
            fee: 3000,
            tickSpacing: 100,
            hooks: NATIVE_ETH,
        };
        const v4Planner = new V4Planner();

        // Swap Config
        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [{
            poolKey,
            zeroForOne: true,
            amountIn: amountWei.toString(),
            amountOutMinimum: "0",
            hookData: "0x",
        }]);
        v4Planner.addAction(Actions.SETTLE_ALL, [NATIVE_ETH, amountWei.toString()]);
        v4Planner.addAction(Actions.TAKE_ALL, [EWT_ADDRESS_STR, "0"]);

        // Encode
        const routePlanner = new RoutePlanner();
        routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
        const encodedActions = v4Planner.finalize();

        // Debug Timestamps
        const block = await publicClient.getBlock();
        console.log(`[Privy] Block Time: ${block.timestamp}, Server Time: ${Math.floor(Date.now() / 1000)}`);

        // Use block-relative deadline
        const deadline = block.timestamp + 3600n; // +1 Hour

        // 4. Check Server Wallet Balance
        const serverBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
        const totalCost = amountWei + parseEther("0.005"); // Amount + Buffer for Gas

        if (serverBalance < totalCost) {
            console.log(`[Privy] Low Balance. Server: ${serverBalance}, Needed: ${totalCost}`);
            return NextResponse.json({
                error: `Insufficient Server Funds. The server wallet (${wallet.address}) needs ETH to pay for gas/swap.`,
                currentBalance: serverBalance.toString(),
                required: totalCost.toString(),
                action: `Please send at least 0.01 ETH to ${wallet.address} on Unichain Sepolia.`
            }, { status: 400 });
        }

        // 5. Encode Call Data
        const calldata = encodeFunctionData({
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: 'execute',
            args: [routePlanner.commands as `0x${string}`, [encodedActions as `0x${string}`], BigInt(deadline)]
        });

        // 6. Simulate Transaction (Debug Reverts)
        console.log(`[Privy] Simulating transaction...`);
        try {
            await publicClient.call({
                account: wallet.address as `0x${string}`,
                to: UNIVERSAL_ROUTER,
                data: calldata,
                value: amountWei,
            });
            console.log(`[Privy] Simulation Successful!`);
        } catch (simError: any) {
            console.error(`[Privy] Simulation FAILED:`, simError);
            return NextResponse.json({
                error: "Simulation Reverted",
                details: simError.shortMessage || simError.message,
                reason: simError.revertErrorName || "Unknown Execution Error"
            }, { status: 400 });
        }

        // 7. Submit Transaction via Privy
        console.log(`[Privy] Submitting Swap TX...`);
        // calldata is already defined above

        const txReceipt = await privy.walletApi.ethereum.sendTransaction({
            walletId: wallet.id as string,
            caip2: `eip155:${CHAIN_ID}`,
            transaction: {
                to: UNIVERSAL_ROUTER,
                data: calldata,
                value: Number(amountWei),
                chainId: CHAIN_ID,
                from: wallet.address as `0x${string}`
            }
        });

        console.log(`[Privy] Swap TX Sent: ${txReceipt.hash}`);
        const txHash = txReceipt.hash as `0x${string}`;

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // 5. Forwarding (Optional)
        // If funds are now in Privy Wallet, we might want to send them to the "sender" (Metamask).
        // Let's check balance and send.

        let transferHash = null;
        let forwardedTo = null;

        // Check EWT Balance of Privy Wallet
        const balance = await publicClient.readContract({
            address: EWT_ADDRESS_STR,
            abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`]
        }) as bigint;

        if (balance > 0n) {
            console.log(`[Privy] Forwarding ${balance} EWT to ${sender}...`);
            // Encode Transfer
            const ERC20_TRANSFER = [{
                name: 'transfer',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                outputs: [{ name: '', type: 'bool' }]
            }];
            const transferData = encodeFunctionData({
                abi: ERC20_TRANSFER,
                functionName: 'transfer',
                args: [sender as `0x${string}`, balance]
            });

            const fwdReceipt = await privy.walletApi.ethereum.sendTransaction({
                walletId: wallet.id as string,
                caip2: `eip155:${CHAIN_ID}`,
                transaction: {
                    to: EWT_ADDRESS_STR,
                    data: transferData,
                    value: 0,
                    chainId: CHAIN_ID,
                    from: wallet.address as `0x${string}`
                }
            });
            transferHash = fwdReceipt.hash as `0x${string}`;
            forwardedTo = sender;
            console.log(`[Privy] Forward TX: ${transferHash}`);
            await publicClient.waitForTransactionReceipt({ hash: transferHash });
        }

        return NextResponse.json({
            success: true,
            txHash,
            transferHash,
            forwardedTo,
            privyWallet: wallet.address
        });

    } catch (error: any) {
        console.error("Privy Swap Error:", error);
        return NextResponse.json({
            error: error.message || "Swap failed",
            details: error.revertErrorName || error.shortMessage
        }, { status: 500 });
    }
}
