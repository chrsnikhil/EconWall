"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface TokenBalance {
    token: {
        id: string;
        name: string;
        symbol: string;
        decimals: number;
    };
    amount: string;
}

interface Wallet {
    id: string;
    address: string;
    blockchain: string;
    state: string;
    walletSetId: string;
    createDate: string;
    balances: TokenBalance[];
}

interface WalletSet {
    id: string;
    name: string;
    createDate: string;
}

export default function WalletsPage() {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletSets, setWalletSets] = useState<WalletSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchWallets();
    }, []);

    const fetchWallets = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/wallet/list");
            const data = await res.json();

            if (data.success) {
                setWallets(data.wallets || []);
                setWalletSets(data.walletSets || []);
            } else {
                setError(data.error || "Failed to fetch wallets");
            }
        } catch (err) {
            setError("Failed to connect to API");
        } finally {
            setLoading(false);
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="w-full px-6 py-6 flex items-center justify-between animate-slide-in-down relative z-10">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity">
                        ECONWALL
                    </Link>
                    <div className="text-muted-foreground text-sm">WALLETS</div>
                </div>
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to Portal
                    </Link>
                    <ThemeToggle />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-6 py-6">
                <div className="max-w-6xl mx-auto">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-in-down">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-3xl font-bold text-foreground">{wallets.length}</div>
                                <div className="text-sm text-muted-foreground">Total Wallets</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-3xl font-bold text-foreground">{walletSets.length}</div>
                                <div className="text-sm text-muted-foreground">Wallet Sets</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-3xl font-bold text-green-500">
                                    {wallets.filter((w) => w.state === "LIVE").length}
                                </div>
                                <div className="text-sm text-muted-foreground">Active Wallets</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <svg
                                    className="animate-spin h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <span>Loading wallets...</span>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <Card className="border-red-500/50 animate-scale-in">
                            <CardContent className="pt-6">
                                <p className="text-red-500">{error}</p>
                                <button
                                    onClick={fetchWallets}
                                    className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Retry
                                </button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Wallets Grid */}
                    {!loading && !error && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in-up">
                            {wallets.map((wallet, index) => (
                                <Card
                                    key={wallet.id}
                                    className="animate-scale-in"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <span
                                                    className={`w-2 h-2 rounded-full ${wallet.state === "LIVE" ? "bg-green-500" : "bg-yellow-500"
                                                        }`}
                                                ></span>
                                                {formatAddress(wallet.address)}
                                            </CardTitle>
                                            <button
                                                onClick={() => copyToClipboard(wallet.address)}
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                                title="Copy address"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                </svg>
                                            </button>
                                        </div>
                                        <CardDescription>
                                            {wallet.blockchain} • {wallet.state}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {/* Balances */}
                                            <div>
                                                <div className="text-xs text-muted-foreground mb-2">Balances</div>
                                                {wallet.balances && wallet.balances.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {wallet.balances.map((balance, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                                                            >
                                                                <span className="text-sm font-medium">
                                                                    {balance.token?.symbol || "Token"}
                                                                </span>
                                                                <span className="text-sm text-foreground">
                                                                    {parseFloat(balance.amount).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
                                                        No tokens yet
                                                    </div>
                                                )}
                                            </div>

                                            {/* Wallet ID */}
                                            <div>
                                                <div className="text-xs text-muted-foreground mb-1">Wallet ID</div>
                                                <div className="text-xs font-mono text-muted-foreground truncate">
                                                    {wallet.id}
                                                </div>
                                            </div>

                                            {/* Created Date */}
                                            <div>
                                                <div className="text-xs text-muted-foreground mb-1">Created</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(wallet.createDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && wallets.length === 0 && (
                        <Card className="animate-scale-in">
                            <CardContent className="pt-6 text-center">
                                <p className="text-muted-foreground mb-4">No wallets found</p>
                                <Link
                                    href="/"
                                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Create a Wallet
                                </Link>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full px-6 py-6 text-center">
                <p className="text-muted-foreground text-xs font-mono">
                    ECONWALL PORTAL v1.0 • Arc Testnet
                </p>
            </footer>
        </div>
    );
}
