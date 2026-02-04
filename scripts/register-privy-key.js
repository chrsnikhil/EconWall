const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
});

const APP_ID = env.PRIVY_APP_ID || env.NEXT_PUBLIC_PRIVY_APP_ID;
const API_KEY = env.PRIVY_API_KEY || env.PRIVY_APP_SECRET;

if (!APP_ID || !API_KEY) {
    console.error('❌ Missing PRIVY_APP_ID or PRIVY_API_KEY in .env.local');
    process.exit(1);
}

// 2. Read Public Key
const pubKeyPath = path.join(__dirname, 'privy-public.pem');
if (!fs.existsSync(pubKeyPath)) {
    console.error('❌ privy-public.pem not found. Run generate-privy-keys.js first.');
    process.exit(1);
}
const publicKey = fs.readFileSync(pubKeyPath, 'utf8');

// 3. Register Key
const registerKey = async () => {
    console.log(`Attempting to register key for App ID: ${APP_ID}`);

    // Retry with auth.privy.io and NO App ID in path (header only)
    const hostname = 'auth.privy.io';
    const path = `/api/v1/authorization-keys`;

    const data = JSON.stringify({
        name: 'Server Wallet Key (Auto-Registered)',
        public_key: publicKey,
        threshold: 1 // Required for non-quorum? Or default. Docs said "1 of 1 key quorum"
        // Sometimes payload differs. Let's try this standard structure.
    });

    const options = {
        hostname: hostname,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'privy-app-id': APP_ID,
            'Authorization': 'Basic ' + Buffer.from(`${APP_ID}:${API_KEY}`).toString('base64')
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('\n✅ Key Registered Successfully!');
                const json = JSON.parse(body);
                console.log('Response:', JSON.stringify(json, null, 2));
                console.log('\nACTION REQUIRED:');
                console.log('Copy the "id" from the response above (likely starting with "quorum_")');
                console.log('Add it to .env.local as PRIVY_WALLET_AUTH_KEY_ID');
            } else {
                console.error(`\n❌ Request Failed: ${res.statusCode}`);
                console.error('Response:', body);

                // Fallback attempt?
                if (res.statusCode === 404) {
                    console.log('Trying alternative endpoint...');
                    // Logic to try api.privy.io or different path could go here but let's see output first.
                }
            }
        });
    });

    req.on('error', (error) => {
        console.error('Network Error:', error);
    });

    req.write(data);
    req.end();
};

registerKey();
