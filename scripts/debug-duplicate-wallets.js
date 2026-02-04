require('dotenv').config({ path: '.env.local' });
const { PrivyClient } = require('@privy-io/server-auth');

async function debugDuplicates() {
    const privy = new PrivyClient(
        process.env.PRIVY_APP_ID,
        process.env.PRIVY_API_KEY,
        { walletApi: { authorizationPrivateKey: process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY } }
    );

    const testId = "test-dup-" + Date.now();
    console.log("🔍 Debugging User:", testId);

    // 1. Create User
    const user = await privy.importUser({
        linkedAccounts: [{ type: 'custom_auth', customUserId: testId }],
        createEthereumWallet: false
    });
    console.log("✅ User Created:", user.id);

    // 2. Create Wallet
    console.log("👉 Creating Wallet 1...");
    const w1 = await privy.walletApi.create({ userId: user.id, chainType: 'ethereum' });
    console.log("✅ Wallet 1:", w1.address);

    // 3. Immediate List
    console.log("\n🔍 Listing Wallets (Immediate):");
    const list1 = await privy.walletApi.getWallets({ userId: user.id });
    console.log("Found:", list1.data?.length, "wallets");
    list1.data?.forEach(w => console.log(` - ${w.address} (Owner: ${w.ownerId})`));

    // 4. Wait 2s
    console.log("\n⏳ Waiting 2s...");
    await new Promise(r => setTimeout(r, 2000));

    // 5. List Again
    console.log("🔍 Listing Wallets (After Delay):");
    const list2 = await privy.walletApi.getWallets({ userId: user.id });
    console.log("Found:", list2.data?.length, "wallets");

    // 6. Check User Object
    console.log("\n🔍 Checking User Object:");
    const userRefetched = await privy.getUser(user.id);
    console.log("Linked Accounts:", userRefetched.linkedAccounts?.length);
}

debugDuplicates();
