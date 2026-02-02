import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// Initialize the Circle Dev-Controlled Wallets client
// This should only be used server-side (API routes, server actions)

let client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

export function getCircleClient() {
    if (!client) {
        const apiKey = process.env.CIRCLE_API_KEY;
        const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

        if (!apiKey || !entitySecret) {
            throw new Error(
                "Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in environment variables"
            );
        }

        client = initiateDeveloperControlledWalletsClient({
            apiKey,
            entitySecret,
        });
    }

    return client;
}

// Arc Testnet token addresses
export const ARC_TOKENS = {
    USDC: "0x3600000000000000000000000000000000000000",
    EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
} as const;

export const BLOCKCHAIN = "ARC-TESTNET" as const;
