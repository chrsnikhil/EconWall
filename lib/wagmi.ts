import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Define Arc Testnet chain
// Define Arc Testnet chain
export const arcTestnet = {
    id: 5042002,
    name: "Arc Testnet",
    nativeCurrency: {
        decimals: 18,
        name: "USDC",
        symbol: "USDC",
    },
    rpcUrls: {
        default: {
            http: ["https://rpc.testnet.arc.network"],
        },
    },
    blockExplorers: {
        default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
    },
    testnet: true,
} as const;

export const config = createConfig({
    chains: [mainnet, sepolia, arcTestnet],
    connectors: [injected()],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [arcTestnet.id]: http(),
    },
});

declare module "wagmi" {
    interface Register {
        config: typeof config;
    }
}
