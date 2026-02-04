const fetch = require('node-fetch');

async function testPersistence() {
    console.log('🧪 Testing Wallet Persistence...');
    const userId = "test-persist-" + Date.now();
    console.log(`User ID: ${userId}`);

    // Call 1
    console.log("\n--- Call 1 (Create) ---");
    const res1 = await fetch('http://localhost:3000/api/wallet/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
    const data1 = await res1.json();
    console.log(`Address 1: ${data1.walletAddress} (IsNew: ${data1.isNew})`);

    // Call 2
    console.log("\n--- Call 2 (Fetch Existing) ---");
    const res2 = await fetch('http://localhost:3000/api/wallet/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
    const data2 = await res2.json();
    console.log(`Address 2: ${data2.walletAddress} (IsNew: ${data2.isNew})`);

    if (data1.walletAddress === data2.walletAddress) {
        console.log("\n✅ SUCCESS: Wallet Persisted!");
    } else {
        console.log("\n❌ FAIL: Wallet changed!");
        console.log("Difference:", data1.walletAddress, "vs", data2.walletAddress);
    }
}

testPersistence();
