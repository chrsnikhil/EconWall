import { PrivyClient } from "@privy-io/server-auth";
import { createPrivateKey } from 'crypto';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_API_KEY;
const PRIVY_WALLET_AUTH_KEY = process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY?.replace(/\\n/g, '\n');

let privyClient: PrivyClient;

try {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error("Missing Privy App ID or Secret");
    }

    if (PRIVY_WALLET_AUTH_KEY) {
        let cleanKey = PRIVY_WALLET_AUTH_KEY
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/\\n/g, '\n');      // Convert literal \n to newlines

        console.log('[Privy Init] Key format detected: PKCS#8 PEM');

        // Extract private key from PKCS#8 PEM format
        try {
            const privateKey = createPrivateKey({
                key: cleanKey,
                format: 'pem',
                type: 'pkcs8'
            });

            // Export the ENTIRE PKCS#8 DER key and convert to base64
            // Privy expects the full PKCS#8 DER bytes as base64, NOT hex!
            const derKey = privateKey.export({ type: 'pkcs8', format: 'der' });
            const base64Key = derKey.toString('base64');

            console.log('[Privy Init] ✅ Successfully exported PKCS#8 DER private key');
            console.log('[Privy Init] Key length:', base64Key.length, 'chars (base64)');
            console.log('[Privy Init] Key preview:', base64Key.substring(0, 40) + '...');

            privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
                walletApi: {
                    authorizationPrivateKey: base64Key  // Pass as BASE64, not hex!
                }
            });

            console.log('[Privy Init] ✅ Privy client initialized successfully');
        } catch (keyError: any) {
            console.error('❌ [Privy Init] Failed to parse PKCS#8 key:', keyError?.message);
            throw keyError;
        }
    } else {
        console.log('[Privy Init] No wallet auth key provided, initializing without wallet API');
        privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    }
} catch (error: any) {
    console.error("❌ [Privy Init] FULL ERROR:", error);
    console.error("❌ [Privy Init] Error Message:", error?.message);
    console.error("❌ [Privy Init] Error Stack:", error?.stack);

    // Fallback dummy client
    privyClient = {
        importUser: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); },
        getUser: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); },
        walletApi: { ethereum: { sendTransaction: async () => { throw new Error("Privy Failed to Initialize (See Server Logs)"); } } }
    } as any;
}

export const privy = privyClient;
