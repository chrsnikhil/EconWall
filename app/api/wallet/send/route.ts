import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { WALLET_FACTORY_ABI, SMART_WALLET_ABI, ERC20_ABI } from "@/lib/wallet-abis";

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_WALLET_FACTORY_ADDRESS as `0x${string}`;
const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

const account = privateKeyToAccount(SERVER_PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: unichainSepolia,
    transport: http(),
});

/**
 * POST - Send ETH or tokens from smart wallet
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ownerAddress, to, amount, tokenAddress } = body;

        if (!ownerAddress || !to || !amount) {
            return NextResponse.json({
                error: "ownerAddress, to, and amount are required"
            }, { status: 400 });
        }

        // Get the smart wallet address
        const smartWallet = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: WALLET_FACTORY_ABI,
            functionName: "getWallet",
            args: [ownerAddress as `0x${string}`],
        });

        const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
        if (smartWallet === ZERO_ADDRESS) {
            return NextResponse.json({ error: "Smart wallet not found" }, { status: 404 });
        }

        let hash: `0x${string}`;

        if (!tokenAddress || tokenAddress === ZERO_ADDRESS) {
            // Send ETH
            console.log(`Sending ${amount} ETH from ${smartWallet} to ${to}`);

            const value = parseEther(amount.toString());

            // Execute via factory (admin can execute on behalf of wallets)
            hash = await walletClient.writeContract({
                address: FACTORY_ADDRESS,
                abi: WALLET_FACTORY_ABI,
                functionName: "executeFor",
                args: [
                    ownerAddress as `0x${string}`,
                    to as `0x${string}`,
                    value,
                    "0x" as `0x${string}` // Empty data for ETH transfer
                ],
            });
        } else {
            // Send ERC20 token
            console.log(`Sending ${amount} tokens (${tokenAddress}) from ${smartWallet} to ${to}`);

            // Get token decimals
            const decimals = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "decimals",
            });

            const value = parseUnits(amount.toString(), decimals);

            // Encode ERC20 transfer call
            const transferData = encodeFunctionData({
                abi: [{
                    name: "transfer",
                    type: "function",
                    inputs: [
                        { name: "to", type: "address" },
                        { name: "amount", type: "uint256" }
                    ],
                    outputs: [{ name: "", type: "bool" }]
                }],
                functionName: "transfer",
                args: [to as `0x${string}`, value]
            });

            // Execute via factory
            hash = await walletClient.writeContract({
                address: FACTORY_ADDRESS,
                abi: WALLET_FACTORY_ABI,
                functionName: "executeFor",
                args: [
                    ownerAddress as `0x${string}`,
                    tokenAddress as `0x${string}`,
                    0n,
                    transferData
                ],
            });
        }

        console.log(`Transaction sent: ${hash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        console.log(`Send complete in block ${receipt.blockNumber}`);

        return NextResponse.json({
            success: true,
            txHash: hash,
            blockNumber: receipt.blockNumber.toString(),
        });
    } catch (error: any) {
        console.error("Error sending:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
