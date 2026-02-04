const { PrivyClient } = require('@privy-io/server-auth');
const fs = require('fs');
const path = require('path');

// 1. Load Env manually to ensure we get exactly what is on disk
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

async function debugSend() {
    console.log('🐞 Starting Debug Send...');

    const appId = env.PRIVY_APP_ID;
    const appSecret = env.PRIVY_API_KEY; // or PRIVY_APP_SECRET
    const authKey = env.PRIVY_WALLET_AUTH_PRIVATE_KEY;

    console.log(`App ID: ${appId}`);
    console.log(`Key Start: ${authKey ? authKey.substring(0, 20) : 'MISSING'}...`);

    if (!authKey) {
        console.error('❌ Missing Auth Key in .env.local');
        return;
    }

    const privy = new PrivyClient(appId, appSecret, {
        walletApi: { authorizationPrivateKey: authKey }
    });

    try {
        // 1. Create a FRESH user to ensure no "old wallet" permissions issues
        console.log('👤 Creating temporary test user...');
        const uniqueId = `debug-user-${Date.now()}`;
        const user = await privy.importUser({
            linkedAccounts: [{ type: 'custom_auth', customUserId: uniqueId }],
            createEthereumWallet: true
        });

        const walletId = user.wallet.id;
        const address = user.wallet.address;
        console.log(`✅ Created User: ${user.id}`);
        console.log(`👛 Wallet: ${address} (ID: ${walletId})`);

        // 2. Try to Send (Simulate)
        // We expect this to fail with "Insufficient Funds" usually, 
        // BUT if Auth is broken, it will fail with "401" or "No valid keys".
        // Use a 0 ETH transaction to self?

        console.log('💸 Attempting 0 ETH self-transfer to test Signing...');

        const runTx = async () => {
            return await privy.walletApi.ethereum.sendTransaction({
                walletId: walletId,
                caip2: 'eip155:11155111', // Sepolia
                transaction: {
                    to: address,
                    value: '0x0', // 0 ETH
                    chainId: 11155111
                }
            });
        };

        const receipt = await runTx();
        console.log('✅ Transaction Signed & Sent! Hash:', receipt.hash);

    } catch (error) {
        console.error('❌ Debug Failed:');
        console.error('Type:', error.type);
        console.error('Message:', error.message);
        console.error('Full Error:', error);
    }
}

debugSend();
