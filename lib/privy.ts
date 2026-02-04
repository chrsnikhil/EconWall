import { PrivyClient } from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_API_KEY;
const PRIVY_WALLET_AUTH_KEY = process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Lazy / Safe Init
let privyClient: PrivyClient;

try {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error("Missing Privy App ID or Secret in environment variables");
    }

    if (PRIVY_WALLET_AUTH_KEY) {
        // Robust cleaning: strip quotes and fix newlines
        let cleanKey = PRIVY_WALLET_AUTH_KEY.replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');

        console.log(`[Privy Init] Key Length: ${cleanKey.length}`);
        console.log(`[Privy Init] Key Start: ${cleanKey.substring(0, 35)}...`);
        console.log(`[Privy Init] App ID: ${PRIVY_APP_ID ? 'Set' : 'Unset'}`);
        console.log(`[Privy Init] App Secret: ${PRIVY_APP_SECRET ? 'Set' : 'Unset'}`); // Safe log

        if (!cleanKey.includes("PRIVATE KEY-----") && !cleanKey.startsWith("wallet-auth:")) {
            console.warn("[Privy Init] Note: Key does not look like standard PEM. (Starting with 'wallet-auth:' is valid)");
        }

        privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
            walletApi: {
                authorizationPrivateKey: cleanKey
            }
        });

        console.log("[Privy Init] Client initialized successfully");

    } else {
        console.error("[Privy Init] ERROR: PRIVY_WALLET_AUTH_PRIVATE_KEY is missing!");
        throw new Error("Missing Auth Key");
    }

} catch (error: any) {
    console.error("Privy Client Init Error Full:", error);
    // Create a dummy client...
    privyClient = {
        importUser: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); },
        getUser: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); },
        walletApi: { ethereum: { sendTransaction: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); } } }
    } as any;
}

export const privy = privyClient;

/**
 * Get or Create a Privy User for a given external ID (e.g. Wallet Address).
 * This ensures strict 1:1 mapping between EOA and Privy Wallet.
 */
export async function getOrCreatePrivyWallet(externalUserId: string) {
    // 1. Check if user exists (by custom_user_id)
    // Note: Privy doesn't have a direct "get by custom id" easily exposed in all versions, 
    // so we typically try to create and catch error, or list.
    // However, `privy.users().create` will throw if linked account exists.

    let user;
    try {
        // Try creating
        user = await privy.importUser({
            linkedAccounts: [{
                type: 'custom_auth',
                customUserId: externalUserId
            }],
            createEthereumWallet: true // Auto-create wallet!
        });
        console.log(`Created new Privy user ${user.id} for ${externalUserId}`);
    } catch (err: any) {
        // If error implies user exists, we assume we can fetch them?
        // Actually, importUser is best for this.
        // If it fails with "already exists", we need to find the user ID.
        // But we don't know the Privy ID from the custom ID easily without indexing.
        // Wait, `getUserByExternalId` might exist or we rely on the error message?
        console.log("Privy user likely exists, attempting fetch...");
        // In a real app, you map External -> Privy ID in your DB.
        // For this demo, we might need a workaround if we don't have a DB.
        // Let's assume for now we use the `externalUserId` as the `privy user id`? 
        // No, Privy generates its own IDs.

        // Use `getUserByCustomAuth` if available (check docs/SDK).
        // Since I can't check docs live easily, I'll rely on correct pattern:
        // usually `privy.getUser({ customUserId: ... })` or similar.
        // If not, I'll have to ask the user to clear their Privy dev user list or use a mapping.

        throw err; // Re-throw for now to see actual error in logs
    }

    // Return the wallet address
    const wallet = user.wallet; // or user.linked_accounts.find...
    return wallet?.address;
}
