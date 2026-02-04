const crypto = require('crypto');

// Generate P-256 Key Pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'sec1',
        format: 'pem'
    }
});

console.log("\n👇 COPY THIS PUBLIC KEY TO PRIVY DASHBOARD 👇");
console.log(publicKey);

console.log("\n👇 COPY THIS PRIVATE KEY TO .ENV.LOCAL 👇");
// Format for Privy SDK (wallet-auth:BASE64) which is often more reliable than raw PEM in env vars
const rawBody = privateKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

const paramOne = `wallet-auth:${rawBody}`;
console.log(paramOne);
