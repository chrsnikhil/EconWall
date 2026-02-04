const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const pemPath = path.join(__dirname, 'privy-private.pem');

try {
    const pemContent = fs.readFileSync(pemPath, 'utf8').trim();
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Escape newlines for .env format (replaces actual newline with \n literal)
    const escapedKey = pemContent.replace(/\n/g, '\\n');

    // Construct the new line
    const newLine = `PRIVY_WALLET_AUTH_PRIVATE_KEY="${escapedKey}"`;

    let newEnvContent;
    if (envContent.includes('PRIVY_WALLET_AUTH_PRIVATE_KEY=')) {
        // Regex to replace existing line, handling potentially multiline or quoted values
        // We assume standad KEY=VALUE format.
        // Match: Start of line, Key, =, then anything until next newline (or end).
        // Since the BAD key might be multiline or messy, we look for the specific bad pattern or just the key.

        // Safer approach: Split lines, find the index, replace.
        const lines = envContent.split('\n');
        const index = lines.findIndex(l => l.startsWith('PRIVY_WALLET_AUTH_PRIVATE_KEY='));

        if (index !== -1) {
            lines[index] = newLine;
            newEnvContent = lines.join('\n');
            console.log('✅ Found and replaced existing key.');
        } else {
            // checking for potential multiline mess?
            // Fallback: append? No, append might duplicate.
            // Let's rely on replace.
            newEnvContent = envContent.replace(/PRIVY_WALLET_AUTH_PRIVATE_KEY=.*(\r?\n|$)/, newLine + '\n');
        }
    } else {
        newEnvContent = envContent + '\n' + newLine;
        console.log('✅ Key not found, appending to file.');
    }

    fs.writeFileSync(envPath, newEnvContent);
    console.log('🎉 .env.local updated successfully with correct PEM key!');

    // Verify
    const verify = fs.readFileSync(envPath, 'utf8');
    if (verify.includes(escapedKey)) {
        console.log('🔍 Verification: Key present in file.');
    } else {
        console.error('❌ Verification Failed: Key not found in file after write.');
    }

} catch (error) {
    console.error('❌ Error fixing .env.local:', error);
}
