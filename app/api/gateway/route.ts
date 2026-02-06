import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { unichainSepolia } from "@/lib/wagmi";
import { privy } from "@/lib/privy";
import { encryptUrl, decryptUrl } from "@/lib/url-crypto";
import { incrementFailures, resetFailures, isMaxFailuresReached } from "@/lib/browse-session";

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
        console.log(`[Agent: Gateway] Triggering auto-swap for ${privyUserId}: ${amount} ETH -> EWT`);

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
            console.log(`[Agent: Gateway] Auto-swap successful! TX: ${result.txHash}`);
            return true;
        } else {
            console.error(`[Agent: Gateway] Auto-swap failed: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[Agent: Gateway] Auto-swap error: ${error.message}`);
        return false;
    }
}

// Helper to handle TTL seizure
async function handleTTLSeizure(privyUserId: string, walletAddress: string): Promise<boolean> {
    console.log(`[Agent: Gateway] TTL Expired for ${walletAddress}. Initiating fund seizure...`);
    try {
        const response = await fetch(`${PROXY_BASE}/api/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                direction: "seize_funds",
                amount: "0", // Amount ignored for seizure
                privyUserId: privyUserId
            }),
        });

        const result = await response.json();
        if (result.success) {
            console.log(`[Agent: Gateway] Seizure successful. Wallet emptied.`);
            return true;
        } else {
            console.error(`[Agent: Gateway] Seizure failed: ${result.error}`);
            return false;
        }

    } catch (err: any) {
        console.error(`[Agent: Gateway] Seizure error: ${err.message}`);
        return false;
    }
}

/**
 * Gateway API with TTL Enforcement
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

        console.log(`[Agent: Gateway] Request for ${name || "unknown"}`);
        console.log(`[Agent: Gateway] Sender: ${sender}, PrivyUserId: ${privyUserId}`);

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
                    console.log(`[Agent: Gateway] Found embedded wallet: ${embeddedWalletAddress}`);
                }
            } catch (err: any) {
                console.warn(`[Agent: Gateway] Privy lookup failed: ${err.message}`);
            }
        }

        // If no privyUserId, use sender as wallet address
        if (!embeddedWalletAddress && sender) {
            embeddedWalletAddress = sender as `0x${string}`;
            console.log(`[Agent: Gateway] Using sender as wallet address: ${embeddedWalletAddress}`);
        }

        if (!embeddedWalletAddress) {
            return NextResponse.json(
                { error: "Could not find embedded wallet. Please log in with Privy." },
                { status: 400 }
            );
        }

        // =================================================================================
        // CONTINUOUS TTL CHECK
        // =================================================================================
        const sessionCookie = req.cookies.get("econwall_session");

        // TTL Duration: 10 minutes (per user request)
        const TTL_MS = 10 * 60 * 1000;

        if (sessionCookie && userPrivyId) {
            try {
                const decrypted = decryptUrl(sessionCookie.value);
                if (decrypted) {
                    const session = JSON.parse(decrypted);
                    if (session.timestamp) {
                        const age = Date.now() - session.timestamp;
                        console.log(`[Agent: Gateway] Session Age: ${Math.floor(age / 1000)}s`);

                        if (age > TTL_MS) {
                            // EXECUTE SEIZURE
                            await handleTTLSeizure(userPrivyId, embeddedWalletAddress);
                            // FALL THROUGH -> Proceed to EWT Balance Check -> Will be 0 -> Auto-Swap triggered
                        }
                    }
                }
            } catch (e) {
                console.warn("[Agent: Gateway] Failed to verify session timestamp:", e);
            }
        }

        // STEP 1: Check ETH balance
        const ethBalance = await getEthBalance(embeddedWalletAddress);
        console.log(`[Agent: Gateway] ETH Balance: ${formatEther(ethBalance)} ETH`);

        if (ethBalance < MIN_ETH_FOR_SWAP) {
            console.log(`[Agent: Gateway] Insufficient ETH - prompting deposit`);
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
        console.log(`[Agent: Gateway] EWT Balance: ${formatEther(ewtBalance)} EWT`);

        if (ewtBalance === 0n) {
            console.log(`[Agent: Gateway] No EWT - triggering auto-swap`);

            if (!userPrivyId) {
                return NextResponse.json(
                    { error: "Cannot auto-swap without privyUserId" },
                    { status: 400 }
                );
            }

            // Check if we already hit max failures for this wallet
            if (isMaxFailuresReached(embeddedWalletAddress)) {
                console.warn(`[Agent: Gateway] Max failures reached for ${embeddedWalletAddress}. Denying access.`);
                return NextResponse.json(
                    { error: "Auto-swap failed multiple times. Please check your wallet manually." },
                    { status: 500 }
                );
            }

            // Trigger auto-swap
            const swapSuccess = await triggerAutoSwap(userPrivyId, "0.001");

            if (!swapSuccess) {
                // INCREMENT FAILURES
                const failures = incrementFailures(embeddedWalletAddress);
                console.warn(`[Agent: Gateway] Auto-swap failed. Failure count: ${failures}`);

                if (failures >= 5) {
                    return NextResponse.json(
                        { error: "Auto-swap failed 5 times. Please try swapping manually in the sidebar." },
                        { status: 500 }
                    );
                }

                // Allow GRACE pass if failures < 5?
                // Actually, if swap fails, they have 0 balance. We can't let them browse for free?
                // OR, the user meant "don't invalidate session immediately" meaning don't kill the cookie/logout.
                // But access to proxy requires a fresh token/signature.
                // If we return error here, Client sets "DENIED" state.

                // User said: "even if balance is zero the browser must wait before invalidating my session ... wait for the 5 failed swaps"
                // This implies we should return success (GRANT ACCESS) temporarily?
                // But that defeats the token gate.

                // ALTERNATIVE INTERPRETATION:
                // The client should keep polling and not show the RED SCREEN until 5 failures.
                // So here we should probably return a specific status code that tells the client "Pending/Retry" instead of "Denied".

                return NextResponse.json(
                    { error: "Auto-swap pending", retry: true, failures },
                    { status: 429 } // Too Many Requests / Retry
                );
            }

            // SUCCESS - Reset failures
            resetFailures(embeddedWalletAddress);

            // Verify swap worked
            const newEwtBalance = await getEwtBalance(embeddedWalletAddress);
            if (newEwtBalance === 0n) {
                // Swap succeeded but balance 0? Weird/Lag?
                // Count this as failure too? Or grace?
                const failures = incrementFailures(embeddedWalletAddress);
                return NextResponse.json(
                    { error: "Swap verified but balance unavailable", retry: true, failures },
                    { status: 429 }
                );
            }

            // Double check reset just in case
            resetFailures(embeddedWalletAddress);

            console.log(`[Agent: Gateway] Auto-swap successful! New EWT balance: ${formatEther(newEwtBalance)}`);
        }

        // STEP 3: Access granted!
        console.log(`[Agent: Gateway] Access granted for ${embeddedWalletAddress}`);

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
        console.log(`[Agent: Gateway] Session cookie set for ${embeddedWalletAddress}`);

        console.log(`[Agent: Gateway] Access granted - returning ${proxyUrl}`);

        return response;

    } catch (error: any) {
        console.error("Gateway error:", error);
        return NextResponse.json(
            { error: error.message || "Gateway error" },
            { status: 500 }
        );
    }
}
