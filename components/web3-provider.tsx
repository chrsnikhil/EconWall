"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

export function Web3Provider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || "";

    return (
        <PrivyProvider
            appId={appId}
            config={{
                loginMethods: ['wallet', 'email'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#676FFF',
                },
                embeddedWallets: {
                    // createOnLogin: 'all-users',
                },
            }}
        >
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </WagmiProvider>
        </PrivyProvider>
    );
}
