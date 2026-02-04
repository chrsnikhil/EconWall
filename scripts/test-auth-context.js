const { PrivyClient } = require('@privy-io/server-auth');
const fs = require('fs');
const path = require('path');

// 1. Load Env manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

async function testContext() {
    console.log('🧪 Testing Authorization Context...');

    const appId = env.PRIVY_APP_ID;
    const appSecret = env.PRIVY_API_KEY;
    const authKey = env.PRIVY_WALLET_AUTH_PRIVATE_KEY;

    // Initialize WITHOUT global key to prove Context works
    const privy = new PrivyClient(appId, appSecret);

    console.log('🔑 Auth Key loaded:', authKey.substring(0, 30) + '...');

    try {
        // 1. Get/Create User
        const targetUserId = "did:privy:cml6uvq7k00y6la0c18ag4rvo"; // The user from logs
        console.log(`👤 Fetching target user: ${targetUserId}...`);

        const user = await privy.getUser(targetUserId);
        const walletId = user.wallet.id;
        const address = user.wallet.address;
        console.log(`✅ User Ready: ${address} (ID: ${walletId})`);

        // 2. Prepare Context
        // The docs say `authorization_private_keys` takes an array of keys
        const authContext = {
            authorization_private_keys: [authKey]
        };

        // 3. Send Transaction with Context
        console.log('💸 Sending 0 ETH with explicit Authorization Context...');

        let txHash;

        // Try the walletApi.ethereum.sendTransaction method WITH context if supported
        try {
            // Note: The method signature might vary. 
            // Docs show: .signMessage(walletId, { message, authorization_context })
            // So for sendTransaction it SHOULD be: 
            // .sendTransaction({ walletId, caip2, transaction, authorization_context }) ??
            // OR 
            // .sendTransaction({ ..., authorization_context }) inside the object?

            // Let's try inserting it into the input object
            const result = await privy.walletApi.ethereum.sendTransaction({
                walletId: walletId,
                caip2: 'eip155:11155111',
                transaction: {
                    to: address,
                    value: '0x0',
                    chainId: 11155111
                },
                authorization_context: authContext
            });
            txHash = result.hash;
        } catch (innerErr) {
            console.log('⚠️ standard call failed, trying alternate signature...');
            // Maybe it's a second argument? (Unlikely for this SDK pattern usually)
            throw innerErr;
        }

        console.log(`✅ SUCCESS! Tx Hash: ${txHash}`);

    } catch (error) {
        console.error('❌ Context Test Failed:', error.message);
        if (error.response) {
            console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testContext();
