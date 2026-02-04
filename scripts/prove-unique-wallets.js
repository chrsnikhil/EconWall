const { privy } = require('../lib/privy');

// Mock function to simulate API environment
async function getUserWallet(userId) {
    console.log(`\n🔍 Lookup for User: ${userId}`);
    try {
        const user = await privy.importUser({
            linkedAccounts: [{ type: 'custom_auth', customUserId: userId }],
            createEthereumWallet: true
        });
        const wallet = user.wallet;
        console.log(`   ✅ Wallet Address: ${wallet.address}`);
        console.log(`   PWID (Privy Wallet ID): ${wallet.id}`);
        return wallet.address;
    } catch (e) {
        console.error("   ❌ Error:", e.message);
    }
}

async function runProof() {
    // We need to load env vars for lib/privy to work
    // But lib/privy uses process.env, which isn't loaded by node automatically.
    // We'll manually load them here.
    const fs = require('fs');
    const path = require('path');
    const dotEnv = require('dotenv');
    dotEnv.config({ path: path.join(__dirname, '../.env.local') });

    console.log("🧪 PROOF: Unique Wallets Per User");

    const userA = "user-alice-" + Date.now();
    const userB = "user-bob-" + Date.now();

    const walletA = await getUserWallet(userA);
    const walletB = await getUserWallet(userB);

    if (walletA && walletB && walletA !== walletB) {
        console.log("\n✅ SUCCESS: Wallets are UNIQUE.");
        console.log(`${userA} -> ${walletA}`);
        console.log(`${userB} -> ${walletB}`);
    } else {
        console.log("\n❌ FAILURE: Wallets are NOT unique or failed.");
    }
}

runProof();
