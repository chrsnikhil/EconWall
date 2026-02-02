import crypto from 'crypto';

// AES-256-CBC encryption for URL obfuscation
const ENCRYPTION_KEY = process.env.URL_ENCRYPTION_KEY || 'econwall-secure-key-for-urls!!'; // 32 chars for AES-256

// Ensure key is exactly 32 bytes for AES-256
function getKey(): Buffer {
    const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
    return Buffer.from(key, 'utf-8');
}

/**
 * Decrypt an AES-256-CBC encrypted URL (from browser)
 * Format: iv (32 hex chars) + ciphertext (hex)
 */
export function decryptUrl(encryptedData: string): string | null {
    try {
        if (encryptedData.length < 34) {
            return null;
        }

        // First 32 hex chars = 16 bytes IV
        const ivHex = encryptedData.slice(0, 32);
        const cipherHex = encryptedData.slice(32);

        const key = getKey();
        const iv = Buffer.from(ivHex, 'hex');
        const ciphertext = Buffer.from(cipherHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('AES Decryption error:', error);
        return null;
    }
}

/**
 * Server-side AES encryption (for testing/reference)
 */
export function encryptUrl(url: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(url, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return: iv (hex) + ciphertext (hex)
    return iv.toString('hex') + encrypted.toString('hex');
}

/**
 * Get the encryption key for client-side use
 * In production, you might want to derive this differently
 */
export function getClientKey(): string {
    return ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
}
