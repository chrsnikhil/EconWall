import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { WALLET_FACTORY_ABI } from "@/lib/wallet-abis";

// Configuration
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_WALLET_FACTORY_ADDRESS as `0x${string}`;
const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PROXY_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// ERC20 ABI for balanceOf
const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Unichain Sepolia client
const chainClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

// Server signer
const signer = privateKeyToAccount(SERVER_PRIVATE_KEY);

/**
 * Get user's smart wallet address from factory
 */
async function getSmartWallet(ownerAddress: `0x${string}`): Promise<`0x${string}` | null> {
    try {
        const wallet = await chainClient.readContract({
            address: FACTORY_ADDRESS,
            abi: WALLET_FACTORY_ABI,
            functionName: "getWallet",
            args: [ownerAddress],
        });

        const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
        if (wallet === ZERO_ADDRESS) return null;

        return wallet as `0x${string}`;
    } catch (error) {
        console.error("Failed to get smart wallet:", error);
        return null;
    }
}

/**
 * Check if a smart wallet has EWT tokens on Unichain Sepolia
 */
async function checkTokenBalance(walletAddress: `0x${string}`): Promise<boolean> {
    try {
        const balance = await chainClient.readContract({
            address: EWT_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [walletAddress],
        });
        return balance > 0n;
    } catch (error) {
        console.error("Failed to check token balance:", error);
        return false;
    }
}

/**
 * Gateway API for CCIP-Read (EIP-3668)
 * 
 * This endpoint handles the offchain lookup from the ENS resolver.
 * It checks if the sender has EWT tokens on Arc, and returns a signed
 * response with the proxy URL.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Parse the CCIP-Read request
        // The format depends on how the resolver encodes the data
        const { sender, data, name } = body;

        if (!sender) {
            return NextResponse.json(
                { error: "Missing sender address" },
                { status: 400 }
            );
        }

        console.log(`Gateway request from ${sender} for ${name || "unknown"}`);

        console.log(`Gateway request from ${sender} for ${name || "unknown"}`);

        // 1. DIRECT CHECK: Does the Sender EOA have EWT?
        // No Smart Wallet lookup needed.
        const hasAccess = await checkTokenBalance(sender as `0x${string}`);

        if (!hasAccess) {
            console.log(`Access denied for ${sender} - EOA has no EWT tokens`);
            return NextResponse.json(
                { error: "Access Denied - No EWT tokens found in your wallet on Unichain Sepolia" },
                { status: 403 }
            );
        }

        console.log(`Access granted for EOA ${sender}`);

        // 2. CONSTRUCT RESPONSE
        // Return the proxy URL for the requested domain
        const domain = name || "ticket.eth";
        const proxyUrl = `${PROXY_BASE}/browse/${domain}`;

        // Encode as ENS Text Record result (string)
        const result = encodeAbiParameters(
            parseAbiParameters("string"),
            [proxyUrl]
        );

        // 3. SIGN THE RESULT
        const messageHash = keccak256(result);
        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        // 4. ENCODE RESPONSE (signature + result)
        const responseData = encodeAbiParameters(
            parseAbiParameters("bytes, bytes"),
            [signature as `0x${string}`, result]
        );

        console.log(`Access granted for ${sender} - returning ${proxyUrl}`);

        return NextResponse.json({
            data: responseData,
            proxyUrl, // Also return plainly for easier frontend use
        });

    } catch (error: any) {
        console.error("Gateway error:", error);
        return NextResponse.json(
            { error: error.message || "Gateway error" },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint for status/info
 */
export async function GET() {
    return NextResponse.json({
        name: "EconWall CCIP-Read Gateway",
        description: "ENS offchain resolver gateway with Arc token gating",
        signer: signer.address,
        ewtToken: EWT_ADDRESS,
        usage: "POST with { sender: '0x...', name: 'domain.eth' }",
    });
}
