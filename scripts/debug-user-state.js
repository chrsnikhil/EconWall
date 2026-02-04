require('dotenv').config({ path: '.env.local' });
const { PrivyClient } = require('@privy-io/server-auth');

async function debugUser() {
    const privy = new PrivyClient(
        process.env.PRIVY_APP_ID,
        process.env.PRIVY_API_KEY,
        { walletApi: { authorizationPrivateKey: process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY } }
    );

    const targetDid = "did:privy:cml7oymoj00fdl10b3jijhes4"; // The user from the logs
    const customId = "0x6fEa4477795cbBDca542BF514D25774743997a66";

    console.log("🔍 Inspecting User:", targetDid);

    try {
        // 1. Fetch directly by DID
        const user = await privy.getUser(targetDid);
        console.log("\n✅ User Found (by DID):");
        console.log(`ID: ${user.id}`);
        console.log(`Linked Accounts: ${user.linkedAccounts?.length}`);

        user.linkedAccounts.forEach((acc, i) => {
            console.log(`  [${i}] Type: ${acc.type}, Chain: ${acc.chainType}, Addr: ${acc.address}`);
        });

        // 2. Search by Custom ID
        console.log(`\n🔍 Searching by Custom ID: ${customId}`);
        // Note: SDK structure might differ, checking getUsers
        try {
            // Some versions use `getUsers` iterators, checking if we can just filter?
            // The user code used `privy.getUsers({ linkedAccountThis... })` which implies it's supported.
            // We'll try the same call.
            // Note: getUsers might not exist on the client instance if it's an old version, 
            // but user logs implied they injected code that ran it.
            // actually `privy.getUsers` is NOT standard in all versions. 
            // `privy.users` is usually the iterator.
            // Let's rely on getUser(DID) for now to see the state.
        } catch (e) {
            console.log("Search skipped or failed:", e.message);
        }

    } catch (error) {
        console.error("❌ Failed to fetch user:", error);
    }
}

debugUser();
