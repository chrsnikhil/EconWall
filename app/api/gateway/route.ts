import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { privy } from "@/lib/privy";
import { encryptUrl } from "@/lib/url-crypto";

// Configuration
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PROXY_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Minimum ETH required to swap (0.001 ETH)
const MIN_ETH_FOR_SWAP = parseEther("0.001");

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
 * Check EWT token balance
 */
async function getEwtBalance(walletAddress: `0x${string}`): Promise<bigint> {
    try {
        const balance = await chainClient.readContract({
            address: EWT_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [walletAddress],
        });
        return balance;
    } catch (error) {
        console.error("Failed to check EWT balance:", error);
        return 0n;
    }
}

/**
 * Check ETH balance
 */
async function getEthBalance(walletAddress: `0x${string}`): Promise<bigint> {
    try {
        return await chainClient.getBalance({ address: walletAddress });
    } catch (error) {
        console.error("Failed to check ETH balance:", error);
        return 0n;
    }
}

/**
 * Trigger auto-swap ETH → EWT via internal API call
 */
async function triggerAutoSwap(privyUserId: string, amount: string = "0.001"): Promise<boolean> {
    try {
        console.log(`[Gateway] Triggering auto-swap for ${privyUserId}: ${amount} ETH → EWT`);

        const response = await fetch(`${PROXY_BASE}/api/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                direction: "eth_to_ewt",
                amount: amount,
                privyUserId: privyUserId
            }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`[Gateway] Auto-swap successful! TX: ${result.txHash}`);
            return true;
        } else {
            console.error(`[Gateway] Auto-swap failed: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[Gateway] Auto-swap error: ${error.message}`);
        return false;
    }
}

/**
 * Gateway API for CCIP-Read (EIP-3668)
 * 
 * Enhanced with auto-swap functionality:
 * 1. Check ETH balance - prompt deposit if zero
 * 2. Check EWT balance - auto-swap if zero
 * 3. Grant access with session cookie
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
        let userPrivyId = privyUserId;

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

        // If no privyUserId, use sender as wallet address
        if (!embeddedWalletAddress && sender) {
            embeddedWalletAddress = sender as `0x${string}`;
            console.log(`[Gateway] Using sender as wallet address: ${embeddedWalletAddress}`);
        }

        if (!embeddedWalletAddress) {
            return NextResponse.json(
                { error: "Could not find embedded wallet. Please log in with Privy." },
                { status: 400 }
            );
        }

        // STEP 1: Check ETH balance
        const ethBalance = await getEthBalance(embeddedWalletAddress);
        console.log(`[Gateway] ETH Balance: ${formatEther(ethBalance)} ETH`);

        if (ethBalance < MIN_ETH_FOR_SWAP) {
            console.log(`[Gateway] Insufficient ETH - prompting deposit`);
            return NextResponse.json(
                {
                    error: "Insufficient ETH in your embedded wallet. Please deposit at least 0.001 ETH to continue.",
                    needsDeposit: true,
                    currentBalance: formatEther(ethBalance),
                    requiredBalance: "0.001"
                },
                { status: 402 } // Payment Required
            );
        }

        // STEP 2: Check EWT balance
        const ewtBalance = await getEwtBalance(embeddedWalletAddress);
        console.log(`[Gateway] EWT Balance: ${formatEther(ewtBalance)} EWT`);

        if (ewtBalance === 0n) {
            console.log(`[Gateway] No EWT - triggering auto-swap`);

            if (!userPrivyId) {
                return NextResponse.json(
                    { error: "Cannot auto-swap without privyUserId" },
                    { status: 400 }
                );
            }

            // Trigger auto-swap
            const swapSuccess = await triggerAutoSwap(userPrivyId, "0.001");

            if (!swapSuccess) {
                return NextResponse.json(
                    { error: "Auto-swap failed. Please try swapping manually in the sidebar." },
                    { status: 500 }
                );
            }

            // Verify swap worked
            const newEwtBalance = await getEwtBalance(embeddedWalletAddress);
            if (newEwtBalance === 0n) {
                return NextResponse.json(
                    { error: "Swap completed but EWT balance still zero. Please try again." },
                    { status: 500 }
                );
            }

            console.log(`[Gateway] Auto-swap successful! New EWT balance: ${formatEther(newEwtBalance)}`);
        }

        // STEP 3: Access granted!
        console.log(`[Gateway] Access granted for ${embeddedWalletAddress}`);

        // Construct response
        const domain = name || "econwall.eth";
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

        // Create response with session cookie for click tracking
        const response = NextResponse.json({
            data: responseData,
            proxyUrl,
            embeddedWallet: embeddedWalletAddress,
            privyUserId: userPrivyId,
        });

        // Set encrypted cookie for tracking during browsing (works with or without privyUserId)
        const encryptedSession = encryptUrl(JSON.stringify({
            wallet: embeddedWalletAddress,
            privyUserId: userPrivyId || null,
            timestamp: Date.now()
        }));
        response.cookies.set("econwall_session", encryptedSession, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24 hours
        });
        console.log(`[Gateway] Session cookie set for ${embeddedWalletAddress}`);

        console.log(`[Gateway] Access granted - returning ${proxyUrl}`);

        return response;

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
        description: "ENS offchain resolver gateway with EWT token gating and auto-swap",
        signer: signer.address,
        ewtToken: EWT_ADDRESS,
        usage: "POST with { sender: '0x...', privyUserId: 'did:privy:...' }",
    });
}
