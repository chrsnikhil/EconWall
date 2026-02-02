"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectWallet } from "@/components/connect-wallet";
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

interface Transaction {
    id: string;
    type: string;
    state: string;
    amounts: string[];
    sourceAddress: string;
    destinationAddress: string;
    txHash: string;
    networkFee: string;
    createDate: string;
    operation: string;
}

interface WalletDetails {
    id: string;
    address: string;
    blockchain: string;
    state: string;
    accountType: string;
    createDate: string;
    name: string;
    refId: string;
}

export default function WalletPage() {
    const { address, isConnected } = useAccount();
    const [wallet, setWallet] = useState<WalletDetails | null>(null);
    const [balances, setBalances] = useState<TokenBalance[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isConnected && address) {
            fetchWalletDetails(address);
        }
    }, [isConnected, address]);

    const fetchWalletDetails = async (metamaskAddress: string) => {
        setLoading(true);
        setError(null);

        try {
            // First, get the Arc wallet for this MetaMask address
            const connectRes = await fetch("/api/wallet/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metamaskAddress }),
            });
            const connectData = await connectRes.json();

            if (!connectData.success) {
                setError("Failed to find Arc wallet");
                return;
            }

            const walletId = connectData.wallet.id;

            // Get detailed wallet info
            const detailsRes = await fetch(`/api/wallet/details?walletId=${walletId}`);
            const detailsData = await detailsRes.json();

            if (detailsData.success) {
                setWallet(detailsData.wallet);
                setBalances(detailsData.balances);
                setTransactions(detailsData.transactions);
            } else {
                setError(detailsData.error || "Failed to fetch wallet details");
            }
        } catch (err) {
            setError("Failed to connect to API");
        } finally {
            setLoading(false);
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const openArcScan = (txHash: string) => {
        window.open(`https://testnet.arcscan.app/tx/${txHash}`, "_blank");
    };

    const openAddressOnArcScan = (addr: string) => {
        window.open(`https://testnet.arcscan.app/address/${addr}`, "_blank");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="w-full px-6 py-6 flex items-center justify-between animate-slide-in-down relative z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="text-xl font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
                    >
                        ECONWALL
                    </Link>
                    <div className="text-muted-foreground text-sm">WALLET</div>
                </div>
                <div className="flex items-center gap-4">
                    <ConnectWallet />
                    <ThemeToggle />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-6 py-6">
                <div className="max-w-4xl mx-auto">
                    {/* Not Connected State */}
                    {!isConnected && (
                        <Card className="animate-scale-in">
                            <CardContent className="pt-6 text-center py-12">
                                <div className="text-6xl mb-4">🦊</div>
                                <p className="text-muted-foreground mb-4">
                                    Connect your MetaMask wallet to view your Arc wallet
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading State */}
                    {isConnected && loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span>Loading wallet details...</span>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <Card className="border-red-500/50 animate-scale-in">
                            <CardContent className="pt-6">
                                <p className="text-red-500">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Wallet Details */}
                    {isConnected && !loading && wallet && (
                        <div className="space-y-6 animate-slide-in-up">
                            {/* Wallet Info Card */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-2xl flex items-center gap-3">
                                                <span
                                                    className={`w-3 h-3 rounded-full ${wallet.state === "LIVE" ? "bg-green-500" : "bg-yellow-500"
                                                        }`}
                                                ></span>
                                                Arc Wallet
                                            </CardTitle>
                                            <CardDescription className="mt-2">
                                                {wallet.blockchain} • {wallet.accountType}
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => copyToClipboard(wallet.address)}
                                                className="px-4 py-2 rounded-xl bg-muted border border-border text-sm hover:bg-muted/80 transition-colors"
                                            >
                                                Copy Address
                                            </button>
                                            <button
                                                onClick={() => openAddressOnArcScan(wallet.address)}
                                                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                                            >
                                                View on ArcScan
                                            </button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-muted/50">
                                            <div className="text-xs text-muted-foreground mb-1">Wallet Address</div>
                                            <div className="font-mono text-sm break-all">{wallet.address}</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-muted/50">
                                            <div className="text-xs text-muted-foreground mb-1">Linked MetaMask</div>
                                            <div className="font-mono text-sm">{wallet.refId || address}</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-muted/50">
                                            <div className="text-xs text-muted-foreground mb-1">Status</div>
                                            <div className="text-sm font-medium text-green-500">{wallet.state}</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-muted/50">
                                            <div className="text-xs text-muted-foreground mb-1">Created</div>
                                            <div className="text-sm">{new Date(wallet.createDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Balances Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Token Balances</CardTitle>
                                    <CardDescription>
                                        Your Arc wallet token holdings
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {balances.length > 0 ? (
                                        <div className="space-y-3">
                                            {balances.map((balance, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold">
                                                            {balance.token?.symbol?.charAt(0) || "$"}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">{balance.token?.name || "Unknown Token"}</div>
                                                            <div className="text-xs text-muted-foreground">{balance.token?.symbol}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-semibold">
                                                            {parseFloat(balance.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{balance.token?.symbol}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="text-4xl mb-3">💰</div>
                                            <p className="text-muted-foreground mb-4">No tokens yet</p>
                                            <a
                                                href="https://faucet.circle.com/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                                            >
                                                Get Testnet USDC
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                    <polyline points="15 3 21 3 21 9" />
                                                    <line x1="10" x2="21" y1="14" y2="3" />
                                                </svg>
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Transactions Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Transactions</CardTitle>
                                    <CardDescription>
                                        Your transaction history on Arc Testnet
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {transactions.length > 0 ? (
                                        <div className="space-y-3">
                                            {transactions.map((tx) => (
                                                <div
                                                    key={tx.id}
                                                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                                                    onClick={() => tx.txHash && openArcScan(tx.txHash)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.type === "OUTBOUND"
                                                                    ? "bg-red-500/20 text-red-500"
                                                                    : "bg-green-500/20 text-green-500"
                                                                }`}
                                                        >
                                                            {tx.type === "OUTBOUND" ? "↑" : "↓"}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">
                                                                {tx.type === "OUTBOUND" ? "Sent" : "Received"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {tx.state} • {new Date(tx.createDate).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div
                                                            className={`font-semibold ${tx.type === "OUTBOUND" ? "text-red-500" : "text-green-500"
                                                                }`}
                                                        >
                                                            {tx.type === "OUTBOUND" ? "-" : "+"}
                                                            {tx.amounts?.[0] || "0"}
                                                        </div>
                                                        {tx.txHash && (
                                                            <div className="text-xs text-muted-foreground font-mono">
                                                                {formatAddress(tx.txHash)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="text-4xl mb-3">📜</div>
                                            <p className="text-muted-foreground">No transactions yet</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
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
