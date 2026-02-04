const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const pemPath = path.join(__dirname, 'privy-private.pem');

try {
    const pemContent = fs.readFileSync(pemPath, 'utf8');

    // Extract Base64 body: Remove headers and newlines
    let base64Body = pemContent
        .replace(/-----BEGIN [A-Z ]+-----/, '')
        .replace(/-----END [A-Z ]+-----/, '')
        .replace(/[\r\n\s]/g, '');

    // Prefix with wallet-auth:
    const formattedKey = `wallet-auth:${base64Body}`;

    console.log('Formatted Key:', formattedKey);

    let envContent = fs.readFileSync(envPath, 'utf8');

    // Construct the new line
    const newLine = `PRIVY_WALLET_AUTH_PRIVATE_KEY=${formattedKey}`;

    let newEnvContent;
    if (envContent.includes('PRIVY_WALLET_AUTH_PRIVATE_KEY=')) {
        // Replace existing line using Regex to capture full previous value
        const regex = /PRIVY_WALLET_AUTH_PRIVATE_KEY=([^\r\n]*)/;
        newEnvContent = envContent.replace(regex, newLine);
        console.log('✅ Replaced existing key definition.');
    } else {
        newEnvContent = envContent + '\n' + newLine;
        console.log('✅ Appended key definition.');
    }

    fs.writeFileSync(envPath, newEnvContent);
    console.log('🎉 .env.local updated with formatted key!');

} catch (error) {
    console.error('❌ Error formatting key:', error);
}
