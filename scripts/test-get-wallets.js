require('dotenv').config({ path: '.env.local' });
const { PrivyClient } = require('@privy-io/server-auth');

async function testGetWallets() {
    const privy = new PrivyClient(
        process.env.PRIVY_APP_ID,
        process.env.PRIVY_API_KEY,
        { walletApi: { authorizationPrivateKey: process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY } }
    );

    const targetDid = "did:privy:cml7oymoj00fdl10b3jijhes4"; // User with suspected multiple wallets
    console.log("🔍 Fetching Wallets for:", targetDid);

    try {
        // Attempt 1: Object syntax (likely correct based on Lint error)
        console.log("👉 Trying object syntax: { userId: ... }");
        // Note: SDK types might differ from runtime. 
        // We will print the result.
        // If getWallets doesn't exist, we'll crash.
        // Actually, let's try to inspect the method if we can.

        // Let's assume typescript is right: Expects object.
        // Does "userId" property exist in RequestType?
        // The Lint said: "Type 'string' has no properties in common with type 'WalletApiFindWalletsRequestType'."
        // This confirms it expects an object.

        // Trying to guess the object shape? 
        // Likely { user_id: ... } or { userId: ... }?
        // Let's try both if one fails. Or inspect errors.

        // Wait, if it returns a response object (with .data?), or an array?

    } catch (e) { console.log("Setup error", e); }

    try {
        // Attempt just passing object
        const res = await privy.walletApi.getWallets({ userId: targetDid });
        console.log("✅ Object Syntax Result:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.log("❌ Object Syntax Failed:", e.message);

        // Attempt 2: Maybe it's not getWallets but getWalletsForUser? No.
    }
}

testGetWallets();
