"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectWallet } from "@/components/connect-wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type AccessStatus = "idle" | "checking" | "granted" | "denied" | "error";

export function PortalSearch() {
    const { address, isConnected } = useAccount();
    const [status, setStatus] = useState<AccessStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleAccessCheck = async () => {
        if (!address) return;

        setStatus("checking");
        setError(null);

        try {
            // Call Gateway API to check EWT token access
            const res = await fetch("/api/gateway", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: address,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setStatus("denied");
                setError(data.error || "Access denied - No EWT tokens");
                return;
            }

            // Access granted - redirect to browser page
            setStatus("granted");

            setTimeout(() => {
                router.push(`/browser?verified=true&wallet=${address?.slice(0, 6)}`);
            }, 500);

        } catch (err: any) {
            console.error("Access check error:", err);
            setStatus("error");
            setError(err.message || "Network error");
        }
    };

    if (!isConnected) {
        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Portal Access</CardTitle>
                    <CardDescription className="text-xs">Connect wallet to access the token-gated browser</CardDescription>
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
                <CardTitle className="text-lg">EconWall Portal</CardTitle>
                <CardDescription className="text-xs">
                    Access the token-gated browser with EWT tokens
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Wallet Info */}
                <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Connected Wallet</div>
                    <div className="text-sm font-mono truncate">
                        {address}
                    </div>
                </div>

                {/* Access Button */}
                {status === "idle" && (
                    <button
                        onClick={handleAccessCheck}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-all duration-300 shadow-sm hover:shadow-lg"
                    >
                        Check Access
                    </button>
                )}

                {/* Status Messages */}
                {status === "checking" && (
                    <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="font-medium">Checking Access...</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Verifying EWT token balance in your smart wallet
                        </div>
                    </div>
                )}

                {status === "granted" && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                        <div className="text-green-600 font-medium mb-1">✓ Access Granted</div>
                        <div className="text-xs text-muted-foreground">
                            Opening browser...
                        </div>
                    </div>
                )}

                {status === "denied" && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center space-y-3">
                        <div className="text-red-500 font-medium">✗ Access Denied</div>
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
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-center text-yellow-600">
                        {error}
                    </div>
                )}

                {/* Info */}
                <div className="text-xs text-muted-foreground text-center pt-2">
                    Requires EWT tokens in your smart wallet
                </div>
            </CardContent>
        </Card>
    );
}
