const { PrivyClient } = require('@privy-io/server-auth');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

async function testClient() {
    console.log('🧪 Testing Privy Client Isolation...');

    // Check Vars
    const appId = env.PRIVY_APP_ID || env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = env.PRIVY_API_KEY || env.PRIVY_APP_SECRET;
    // Handle multiline private key manually if needed?
    // Actually, our previous append might have messed up newlines if not careful.
    // Let's print the length of the keys.
    console.log(`App ID: ${appId}`);
    console.log(`Secret Length: ${appSecret ? appSecret.length : 0}`);

    // The private key in env might be one line or encoded?
    // In our command we did `Add-Content ... -Value "... \n ..."` 
    // Powershell `n` is newline. But reading it back might differ.
    let privKey = env.PRIVY_WALLET_AUTH_PRIVATE_KEY;
    // Replace literal "\n" characters with actual newlines if they were escaped
    if (privKey) {
        privKey = privKey.replace(/\\n/g, '\n');
    }

    console.log(`Auth Key Length: ${privKey ? privKey.length : 0}`);

    try {
        const privy = new PrivyClient(appId, appSecret, {
            walletApi: {
                authorizationPrivateKey: privKey
            }
        });

        console.log('Client Initialized. Fetching App Settings...');
        const settings = await privy.getAppSettings();
        console.log('✅ App Settings Fetched:', settings.name);

    } catch (e) {
        console.error('❌ Client Test Failed:', e);
    }
}

testClient();
