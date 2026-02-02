// Run this script to register your Entity Secret
// Usage: npx tsx --env-file=.env.local scripts/setup-entity-secret.ts <entity_secret>

import {
    generateEntitySecret,
    registerEntitySecretCiphertext,
} from "@circle-fin/developer-controlled-wallets";

async function main() {
    const entitySecret = process.argv[2];
    const apiKey = process.env.CIRCLE_API_KEY;

    // If no entity secret provided, just generate one
    if (!entitySecret) {
        console.log("=== Generating Entity Secret ===\n");
        generateEntitySecret();
        console.log("\n=== Next Step ===");
        console.log("Copy the ENTITY SECRET above and run:");
        console.log("  npx tsx --env-file=.env.local scripts/setup-entity-secret.ts <ENTITY_SECRET>\n");
        return;
    }

    // Validate entity secret format (64 hex characters)
    if (!/^[a-f0-9]{64}$/.test(entitySecret)) {
        console.error("Error: Entity secret must be 64 lowercase hex characters");
        return;
    }

    if (!apiKey) {
        console.error("Error: CIRCLE_API_KEY not found in environment");
        console.log("Make sure .env.local contains: CIRCLE_API_KEY=TEST_API_KEY:...");
        return;
    }

    console.log("=== Registering Entity Secret ===\n");
    console.log("Entity Secret:", entitySecret);
    console.log("API Key:", apiKey.substring(0, 20) + "...\n");

    try {
        const response = await registerEntitySecretCiphertext({
            apiKey,
            entitySecret,
            recoveryFileDownloadPath: "./scripts/recovery",
        });

        console.log("✅ Entity Secret registered successfully!\n");
        console.log("Recovery file saved to: ./scripts/recovery/");
        console.log("⚠️  IMPORTANT: Store the recovery file in a safe location!\n");

        console.log("=== Add this to your .env.local ===\n");
        console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
    } catch (error) {
        console.error("Error registering Entity Secret:", error);
    }
}

main();
