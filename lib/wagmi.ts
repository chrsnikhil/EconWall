import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Define Arc Testnet chain
export const arcTestnet = {
    id: 1637450, // Arc Testnet chain ID - update if different
    name: "Arc Testnet",
    nativeCurrency: {
        decimals: 18,
        name: "ETH",
        symbol: "ETH",
    },
    rpcUrls: {
        default: {
            http: ["https://testnet.rpc.arc.network"], // Update with actual RPC
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
