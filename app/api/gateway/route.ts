import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { privy } from "@/lib/privy";

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
 * Check if a wallet has EWT tokens on Unichain Sepolia
 */
async function checkTokenBalance(walletAddress: `0x${string}`): Promise<boolean> {
    try {
        const balance = await chainClient.readContract({
            address: EWT_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [walletAddress],
        });
        console.log(`[Gateway] Balance check for ${walletAddress}: ${balance.toString()} EWT`);
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
 * It checks if the user's EMBEDDED WALLET has EWT tokens on Unichain Sepolia.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sender, data, name, privyUserId } = body;

        if (!sender && !privyUserId) {
            return NextResponse.json(
                { error: "Missing sender address or privyUserId" },
                { status: 400 }
            );
        }

        console.log(`[Gateway] Request for ${name || "unknown"}`);
        console.log(`[Gateway] Sender: ${sender}, PrivyUserId: ${privyUserId}`);

        let embeddedWalletAddress: `0x${string}` | null = null;

        // Get user's embedded wallet from Privy
        if (privyUserId) {
            try {
                const user = await privy.getUser(privyUserId);
                const embeddedWallet = user.linkedAccounts?.find(
                    (account: any) =>
                        account.type === 'wallet' &&
                        account.walletClientType === 'privy'
                ) as any;

                if (embeddedWallet) {
                    embeddedWalletAddress = embeddedWallet.address as `0x${string}`;
                    console.log(`[Gateway] Found embedded wallet: ${embeddedWalletAddress}`);
                }
            } catch (err: any) {
                console.warn(`[Gateway] Privy lookup failed: ${err.message}`);
            }
        }

        // If no privyUserId, try to find embedded wallet by sender address
        if (!embeddedWalletAddress && sender) {
            // The sender might BE the embedded wallet address
            // Check if it has tokens
            embeddedWalletAddress = sender as `0x${string}`;
            console.log(`[Gateway] Using sender as wallet address: ${embeddedWalletAddress}`);
        }

        if (!embeddedWalletAddress) {
            return NextResponse.json(
                { error: "Could not find embedded wallet. Please log in with Privy." },
                { status: 400 }
            );
        }

        // Check EWT balance on user's embedded wallet ONLY
        const hasAccess = await checkTokenBalance(embeddedWalletAddress);

        if (!hasAccess) {
            console.log(`[Gateway] Access denied - No EWT tokens in embedded wallet ${embeddedWalletAddress}`);
            return NextResponse.json(
                { error: `Access Denied - No EWT tokens found in your embedded wallet (${embeddedWalletAddress.slice(0, 6)}...${embeddedWalletAddress.slice(-4)})` },
                { status: 403 }
            );
        }

        console.log(`[Gateway] Access granted for embedded wallet ${embeddedWalletAddress}`);

        // Construct response
        const domain = name || "ticket.eth";
        const proxyUrl = `${PROXY_BASE}/browse/${domain}`;

        // Encode as ENS Text Record result (string)
        const result = encodeAbiParameters(
            parseAbiParameters("string"),
            [proxyUrl]
        );

        // Sign the result
        const messageHash = keccak256(result);
        const signature = await signer.signMessage({
            message: { raw: messageHash },
        });

        // Encode response (signature + result)
        const responseData = encodeAbiParameters(
            parseAbiParameters("bytes, bytes"),
            [signature as `0x${string}`, result]
        );

        console.log(`[Gateway] Access granted - returning ${proxyUrl}`);

        return NextResponse.json({
            data: responseData,
            proxyUrl,
            embeddedWallet: embeddedWalletAddress,
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
        description: "ENS offchain resolver gateway with EWT token gating (embedded wallets only)",
        signer: signer.address,
        ewtToken: EWT_ADDRESS,
        usage: "POST with { sender: '0x...', privyUserId: 'did:privy:...' }",
    });
}
