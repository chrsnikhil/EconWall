"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { sepolia } from "viem/chains";
import { ConnectWallet } from "@/components/connect-wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type AccessStatus = "idle" | "checking" | "granted" | "denied" | "error";

// Create a Sepolia client for ENS resolution
// Resolution always starts from L1 (Mainnet or Sepolia for testing)
const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(),
});

export function PortalSearch() {
    const { address, isConnected } = useAccount();
    const [domain, setDomain] = useState("");
    const [status, setStatus] = useState<AccessStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

    /**
     * Full ENS CCIP-Read Resolution Flow:
     * 1. User enters domain (e.g., "ticket.eth")
     * 2. Viem calls resolver on Sepolia
     * 3. SurgeResolver reverts with OffchainLookup
     * 4. Viem automatically calls our Gateway API
     * 5. Gateway checks Arc balance, returns signed proxy URL
     * 6. Viem calls resolveWithProof to verify signature
     * 7. Frontend receives proxy URL and redirects
     */
    const handleSearch = async () => {
        if (!domain || !address) return;

        setStatus("checking");
        setError(null);
        setResolvedUrl(null);

        const normalizedDomain = domain.toLowerCase().trim();

        try {
            // Method 1: Try ENS resolution via CCIP-Read
            // This will automatically handle the OffchainLookup flow
            // if the domain has a CCIP-Read enabled resolver
            let proxyUrl: string | null = null;

            try {
                // Try to get the 'url' text record via CCIP-Read
                proxyUrl = await sepoliaClient.getEnsText({
                    name: normalize(normalizedDomain),
                    key: "url",
                });
            } catch (ensError: any) {
                console.log("ENS resolution failed or not configured:", ensError.message);
                // Domain might not have CCIP-Read resolver yet
            }

            // Method 2: Fallback - Direct gateway call
            // This is useful when resolver is not yet deployed/configured
            if (!proxyUrl) {
                console.log("Falling back to direct gateway call...");

                const res = await fetch("/api/gateway", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sender: address,
                        name: normalizedDomain,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setStatus("denied");
                    setError(data.error || "Access denied - No EWT tokens");
                    return;
                }

                proxyUrl = data.proxyUrl;
            }

            if (!proxyUrl) {
                setStatus("error");
                setError("Could not resolve domain");
                return;
            }

            // Success - redirect to proxy
            setStatus("granted");
            setResolvedUrl(proxyUrl);

            setTimeout(() => {
                window.location.href = proxyUrl!;
            }, 800);

        } catch (err: any) {
            console.error("Resolution error:", err);
            setStatus("error");
            setError(err.message || "Network error");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    if (!isConnected) {
        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Portal Access</CardTitle>
                    <CardDescription className="text-xs">Connect wallet to access protected content</CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectWallet />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Portal Search</CardTitle>
                <CardDescription className="text-xs">
                    Enter an ENS domain to access token-gated content
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Wallet Info */}
                <div className="text-xs text-muted-foreground font-mono truncate">
                    Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>

                {/* Search Input */}
                <div className="space-y-2">
                    <div className="relative">
                        <input
                            type="text"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="ticket.eth"
                            disabled={status === "checking"}
                            className="w-full h-12 px-4 pr-20 rounded-lg bg-muted border-0 font-mono text-sm focus:ring-2 focus:ring-primary"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!domain || status === "checking"}
                            className="absolute right-2 top-2 h-8 px-4 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                        >
                            {status === "checking" ? "..." : "Go"}
                        </button>
                    </div>
                </div>

                {/* Status Messages */}
                {status === "checking" && (
                    <div className="p-3 bg-muted rounded text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <div className="text-left">
                                <div>Resolving ENS via CCIP-Read...</div>
                                <div className="text-xs text-muted-foreground">Checking EWT balance on Arc</div>
                            </div>
                        </div>
                    </div>
                )}

                {status === "granted" && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-center space-y-1">
                        <div className="text-green-600 font-medium">Access Granted</div>
                        {resolvedUrl && (
                            <div className="text-xs text-muted-foreground font-mono truncate">
                                {resolvedUrl}
                            </div>
                        )}
                        <div className="text-xs text-green-600">Redirecting...</div>
                    </div>
                )}

                {status === "denied" && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-center space-y-3">
                        <div className="text-red-500 font-medium">Access Denied</div>
                        <div className="text-xs text-muted-foreground">{error}</div>
                        <a
                            href="/"
                            className="inline-block px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                            Get EWT Tokens
                        </a>
                    </div>
                )}

                {status === "error" && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-center text-yellow-600">
                        {error}
                    </div>
                )}

                {/* Info */}
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                    <div className="flex justify-between">
                        <span>Resolution Chain:</span>
                        <span className="font-medium">Sepolia (L1)</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Token Check:</span>
                        <span className="font-medium">Arc Testnet (EWT)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
