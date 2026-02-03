import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { WALLET_FACTORY_ABI } from "@/lib/wallet-abis";

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
 * GET - Check if wallet exists for address
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get("address") as `0x${string}`;

        if (!address) {
            return NextResponse.json({ error: "Address required" }, { status: 400 });
        }

        // Check if wallet exists
        const walletAddress = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: WALLET_FACTORY_ABI,
            functionName: "getWallet",
            args: [address],
        });

        const hasWallet = walletAddress !== "0x0000000000000000000000000000000000000000";

        return NextResponse.json({
            success: true,
            hasWallet,
            wallet: hasWallet ? walletAddress : null,
        });
    } catch (error: any) {
        console.error("Error checking wallet:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST - Create wallet for address
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address) {
            return NextResponse.json({ error: "Address required" }, { status: 400 });
        }

        const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

        // Check if wallet already exists
        const existingWallet = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: WALLET_FACTORY_ABI,
            functionName: "getWallet",
            args: [address as `0x${string}`],
        });

        if (existingWallet !== ZERO_ADDRESS) {
            return NextResponse.json({
                success: true,
                wallet: existingWallet,
                isNew: false,
            });
        }

        // Create new wallet
        console.log(`Creating smart wallet for ${address}...`);

        const hash = await walletClient.writeContract({
            address: FACTORY_ADDRESS,
            abi: WALLET_FACTORY_ABI,
            functionName: "getOrCreateWallet",
            args: [address as `0x${string}`],
        });

        console.log(`Transaction sent: ${hash}`);

        // Wait for confirmation with more blocks
        const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 2
        });

        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        // Wait for RPC to sync state
        await new Promise(r => setTimeout(r, 3000));

        // Try reading wallet with retry
        let newWallet = ZERO_ADDRESS;
        for (let i = 0; i < 3; i++) {
            const walletFromContract = await publicClient.readContract({
                address: FACTORY_ADDRESS,
                abi: WALLET_FACTORY_ABI,
                functionName: "getWallet",
                args: [address as `0x${string}`],
            });

            if (walletFromContract !== ZERO_ADDRESS) {
                newWallet = walletFromContract;
                break;
            }

            console.log(`Retry ${i + 1}: wallet still zero, waiting...`);
            await new Promise(r => setTimeout(r, 2000));
        }

        // Final check
        if (newWallet === ZERO_ADDRESS) {
            console.error(`Wallet creation may have failed - got zero address`);
            return NextResponse.json({
                error: "Wallet creation pending - please refresh in a few seconds",
                txHash: hash
            }, { status: 202 });
        }

        console.log(`Smart wallet created: ${newWallet} for ${address}`);

        return NextResponse.json({
            success: true,
            wallet: newWallet,
            isNew: true,
            txHash: hash,
        });
    } catch (error: any) {
        console.error("Error creating wallet:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

