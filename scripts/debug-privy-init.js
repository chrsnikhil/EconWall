require('dotenv').config({ path: '.env.local' });
const { PrivyClient } = require('@privy-io/server-auth');

async function debug() {
    console.log("🔍 Debugging Privy Client Init...");

    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_API_KEY;
    const authKey = process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY;

    console.log(`App ID: ${appId ? 'Present' : 'Missing'}`);
    console.log(`App Secret: ${appSecret ? 'Present' : 'Missing'}`);
    console.log(`Auth Key: ${authKey ? (authKey.substring(0, 20) + '...') : 'Missing'}`);

    if (!appId || !appSecret || !authKey) {
        console.error("❌ Mssing env vars");
        return;
    }

    try {
        const client = new PrivyClient(appId, appSecret, {
            walletApi: {
                authorizationPrivateKey: authKey
            }
        });
        console.log("✅ Client Initialized Successfully!");

        // Try a simple get user call to verify creds
        // We'll use a fake ID just to see if it auths (it should 404, not 401)
        try {
            await client.getUser('did:privy:fake');
        } catch (e) {
            console.log(`Call result: ${e.message}`); // Expected to fail, but check *how* related to auth
        }

    } catch (error) {
        console.error("❌ Init Failed:", error);
    }
}

debug();
