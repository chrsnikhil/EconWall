const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Generating ES256 Key Pair for Privy Authorization...');

const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256 for ES256
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'sec1',
        format: 'pem'
    }
});

const pubPath = path.join(__dirname, 'privy-public.pem');
const privPath = path.join(__dirname, 'privy-private.pem');

fs.writeFileSync(pubPath, publicKey);
fs.writeFileSync(privPath, privateKey);

console.log('\n✅ Keys Generated Successfully!');
console.log(`Public Key:  ${pubPath}`);
console.log(`Private Key: ${privPath}`);
console.log('\nACTION REQUIRED:');
console.log('1. Go to Privy Dashboard -> Server Wallets -> Authorization Keys.');
console.log('2. Click "New Key" -> "Register Key Quorum".');
console.log('3. Paste the contents of privy-public.pem');
console.log('4. Copy the "Quorum ID" and add it to your .env.local as PRIVY_WALLET_AUTH_KEY_ID');
console.log('5. Copy the contents of privy-private.pem to PRIVY_WALLET_AUTH_PRIVATE_KEY (replace newlines with \\n)');
