import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
// Configuration
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
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
 * Check if the User EOA has EWT tokens on Unichain Sepolia
 */

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

        // 1. Resolve Privy Wallet (Server-Side Wallet)
        let privyWalletAddress: `0x${string}` | null = null;
        try {
            // Import/Get User via Privy (using helper logic inline or imported)
            // Reusing the Privy helper we made would be cleaner if exported, but let's keep it robust here or import.
            // Actually, let's use the lib/privy helper! 
            // I need to import { getOrCreatePrivyWallet } from "@/lib/privy";
            // Wait, I need to add that import at top.
        } catch (e) {
            console.log("Privy wallet lookup failed (ignoring for now):", e);
        }

        // However, I can't edit imports easily with this replace block if I don't target the top.
        // Let's do a MultiReplace.

        // Actually, let's just do the check here.
        // I'll assume the user might have EWT on EOA OR Privy Wallet.

        // 1. Check EOA
        let hasAccess = await checkTokenBalance(sender as `0x${string}`);

        // 2. Check Privy Wallet (if EOA failed)
        if (!hasAccess) {
            console.log(`EOA has no tokens. Checking Privy Server Wallet for ${sender}...`);
            try {
                const { getOrCreatePrivyWallet } = await import("@/lib/privy");
                const walletAddr = await getOrCreatePrivyWallet(sender);
                if (walletAddr) {
                    console.log(`Found Privy Wallet: ${walletAddr}`);
                    hasAccess = await checkTokenBalance(walletAddr as `0x${string}`);
                }
            } catch (err: any) {
                console.warn(`Privy check failed: ${err.message}`);
            }
        }

        if (!hasAccess) {
            console.log(`Access denied for ${sender}`);
            return NextResponse.json(
                { error: "Access Denied - No EWT tokens found in your EOA or Server Wallet" },
                { status: 403 }
            );
        }

        console.log(`Access granted for ${sender}`);

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
