import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Define Unichain Sepolia (Chain ID 1301)
export const unichainSepolia = {
    id: 1301,
    name: "Unichain Sepolia",
    nativeCurrency: {
        decimals: 18,
        name: "Ethereum",
        symbol: "ETH",
    },
    rpcUrls: {
        default: {
            http: ["https://sepolia.unichain.org"],
        },
    },
    blockExplorers: {
        default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" },
    },
    testnet: true,
} as const;

export const config = createConfig({
    chains: [mainnet, sepolia, unichainSepolia],
    connectors: [injected()],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [unichainSepolia.id]: http(),
    },
});

declare module "wagmi" {
    interface Register {
        config: typeof config;
    }
}
