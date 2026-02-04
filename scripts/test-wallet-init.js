const fetch = require('node-fetch');

async function testWalletInit() {
    console.log('🧪 Testing Wallet Initialization...');

    const userId = "test-user-" + Date.now(); // Unique ID
    console.log(`User ID: ${userId}`);

    try {
        const response = await fetch('http://localhost:3000/api/wallet/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const text = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Body:', text);

        if (response.ok) {
            const data = JSON.parse(text);
            console.log('\n✅ Success!');
            console.log('Privy User ID:', data.privyUserId);
            console.log('Wallet Address:', data.walletAddress);
        }
    } catch (error) {
        console.error('\n❌ Network Error:', error.message);
        console.log('Make sure the dev server is running on http://localhost:3000');
    }
}

testWalletInit();
