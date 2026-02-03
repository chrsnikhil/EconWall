"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownUp } from "lucide-react"; // We might need an icon, will use SVG if this fails

interface WalletBalances {
    eth: {
        symbol: string;
        balance: string;
        rawBalance: string;
    };
    tokens: Array<{
        symbol: string;
        address: string;
        balance: string;
        rawBalance: string;
    }>;
}

type TabType = "overview" | "swap" | "send" | "receive";

export function WalletDashboard() {
    const { address, isConnected } = useAccount();
    const [smartWallet, setSmartWallet] = useState<string | null>(null);
    const [balances, setBalances] = useState<WalletBalances | null>(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("overview");

    // Send form state
    const [sendTo, setSendTo] = useState("");
    const [sendAmount, setSendAmount] = useState("");
    const [sending, setSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Swap form state
    const [swapDirection, setSwapDirection] = useState<"eth_to_ewt" | "ewt_to_eth">("eth_to_ewt");
    const [swapAmount, setSwapAmount] = useState("");
    const [quote, setQuote] = useState<string | null>(null);
    const [swapping, setSwapping] = useState(false);
    const [swapStatus, setSwapStatus] = useState<string | null>(null);

    // Check/Create smart wallet when MetaMask connects
    useEffect(() => {
        if (isConnected && address) {
            checkOrCreateWallet(address);
        } else {
            setSmartWallet(null);
            setBalances(null);
        }
    }, [isConnected, address]);

    // Fetch balances when smart wallet is set
    useEffect(() => {
        if (smartWallet) {
            fetchBalances(smartWallet);
            const interval = setInterval(() => fetchBalances(smartWallet), 10000);
            return () => clearInterval(interval);
        }
    }, [smartWallet]);

    // Get quote when swap amount changes
    useEffect(() => {
        const getQuote = async () => {
            if (!swapAmount || parseFloat(swapAmount) <= 0) {
                setQuote(null);
                return;
            }
            try {
                const res = await fetch(`/api/swap?direction=${swapDirection}&amount=${swapAmount}`);
                const data = await res.json();
                if (data.success) {
                    setQuote(data.outputAmount);
                }
            } catch (e) {
                console.error("Quote error:", e);
            }
        };

        const timer = setTimeout(getQuote, 500); // Debounce
        return () => clearTimeout(timer);
    }, [swapAmount, swapDirection]);

    const isValidWallet = (addr: string | null): boolean => {
        if (!addr) return false;
        if (addr === "0x0000000000000000000000000000000000000000") return false;
        if (addr.startsWith("0x000000")) return false;
        return true;
    };

    const checkOrCreateWallet = async (ownerAddress: string) => {
        setLoading(true);
        try {
            const checkRes = await fetch(`/api/wallet?address=${ownerAddress}`);
            const checkData = await checkRes.json();
            console.log("Check wallet response:", checkData);

            if (checkData.hasWallet && isValidWallet(checkData.wallet)) {
                setSmartWallet(checkData.wallet);
            } else {
                setSmartWallet(null);
            }
        } catch (error) {
            console.error("Error checking wallet:", error);
        } finally {
            setLoading(false);
        }
    };

    const createWallet = async () => {
        if (!address) return;
        setCreating(true);
        try {
            const res = await fetch("/api/wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
            });
            const data = await res.json();
            console.log("Create wallet response:", data);

            if (data.success && isValidWallet(data.wallet)) {
                setSmartWallet(data.wallet);
            } else if (data.error) {
                console.error("Wallet creation failed:", data.error);
            }
        } catch (error) {
            console.error("Error creating wallet:", error);
        } finally {
            setCreating(false);
        }
    };

    const fetchBalances = async (walletAddress: string) => {
        try {
            const res = await fetch(`/api/wallet/balances?wallet=${walletAddress}`);
            const data = await res.json();
            if (data.success) {
                setBalances(data.balances);
            }
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    };

    const handleSend = async () => {
        if (!address || !sendTo || !sendAmount) return;

        setSending(true);
        setSendStatus("Sending...");

        try {
            const res = await fetch("/api/wallet/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ownerAddress: address,
                    to: sendTo,
                    amount: sendAmount,
                    tokenAddress: null, // ETH
                }),
            });
            const data = await res.json();

            if (data.success) {
                setSendStatus(`✓ Sent! Tx: ${data.txHash.slice(0, 10)}...`);
                setSendTo("");
                setSendAmount("");
                if (smartWallet) fetchBalances(smartWallet);
            } else {
                setSendStatus(`✗ Failed: ${data.error}`);
            }
        } catch (error: any) {
            setSendStatus(`✗ Error: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    const handleSwap = async () => {
        if (!address || !swapAmount) return;

        setSwapping(true);
        setSwapStatus("Swapping...");

        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ownerAddress: address,
                    direction: swapDirection,
                    amount: swapAmount,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setSwapStatus(`✓ Swapped! Tx: ${data.txHash.slice(0, 10)}...`);
                setSwapAmount("");
                setQuote(null);
                if (smartWallet) fetchBalances(smartWallet);
            } else {
                setSwapStatus(`✗ Failed: ${data.error}`);
            }
        } catch (error: any) {
            setSwapStatus(`✗ Error: ${error.message}`);
        } finally {
            setSwapping(false);
        }
    };

    const copyAddress = () => {
        if (smartWallet) {
            navigator.clipboard.writeText(smartWallet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatAddress = (addr: string) => `${addr.slice(0, 10)}...${addr.slice(-8)}`;
    const formatBalance = (bal: string) => parseFloat(bal).toFixed(4);

    if (!isConnected) return null;

    if (loading) {
        return (
            <Card className="w-full max-w-md">
                <CardContent className="p-6 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading wallet...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!smartWallet) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-lg">Smart Wallet</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Create your personal smart wallet to manage assets on Unichain.
                        </p>
                        <button
                            onClick={createWallet}
                            disabled={creating}
                            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                        >
                            {creating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Smart Wallet"
                            )}
                        </button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Smart Wallet</span>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    {(["overview", "swap", "send", "receive"] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <>
                        {/* Wallet Address */}
                        <div className="p-3 bg-muted rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Wallet Address</div>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-sm font-mono">{formatAddress(smartWallet)}</code>
                                <button
                                    onClick={copyAddress}
                                    className="p-2 rounded-lg bg-background hover:bg-background/80 border border-border transition-colors"
                                    title="Copy full address"
                                >
                                    {copied ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Balances */}
                        {balances && (
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Balances</div>
                                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">Ξ</div>
                                        <span className="font-medium">ETH</span>
                                    </div>
                                    <span className="font-mono">{formatBalance(balances.eth.balance)}</span>
                                </div>
                                {balances.tokens.map((token) => (
                                    <div key={token.address} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs">$</div>
                                            <span className="font-medium">{token.symbol}</span>
                                        </div>
                                        <span className="font-mono">{formatBalance(token.balance)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Swap Tab */}
                {activeTab === "swap" && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {/* Input Token */}
                            <div className="p-3 bg-muted rounded-lg space-y-2">
                                <div className="text-xs text-muted-foreground flex justify-between">
                                    <span>From</span>
                                    <span>Balance: {
                                        swapDirection === "eth_to_ewt"
                                            ? `${formatBalance(balances?.eth.balance || "0")} ETH`
                                            : `${formatBalance(balances?.tokens.find(t => t.symbol === "EWT")?.balance || "0")} EWT`
                                    }</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={swapAmount}
                                        onChange={(e) => setSwapAmount(e.target.value)}
                                        placeholder="0.0"
                                        className="w-full bg-transparent text-xl font-mono focus:outline-none"
                                    />
                                    <div className="px-2 py-1 bg-background rounded text-xs font-bold">
                                        {swapDirection === "eth_to_ewt" ? "ETH" : "EWT"}
                                    </div>
                                </div>
                            </div>

                            {/* Swap Direction Toggle */}
                            <div className="flex justify-center -my-3 relative z-10">
                                <button
                                    onClick={() => {
                                        setSwapDirection(prev => prev === "eth_to_ewt" ? "ewt_to_eth" : "eth_to_ewt");
                                        setQuote(null);
                                    }}
                                    className="p-2 bg-background border rounded-full hover:bg-muted transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M7 10l5-6 5 6" />
                                        <path d="M17 14l-5 6-5-6" />
                                    </svg>
                                </button>
                            </div>

                            {/* Output Token */}
                            <div className="p-3 bg-muted rounded-lg space-y-2">
                                <div className="text-xs text-muted-foreground flex justify-between">
                                    <span>To (Estimated)</span>
                                    <span>Balance: {
                                        swapDirection === "eth_to_ewt"
                                            ? `${formatBalance(balances?.tokens.find(t => t.symbol === "EWT")?.balance || "0")} EWT`
                                            : `${formatBalance(balances?.eth.balance || "0")} ETH`
                                    }</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-full text-xl font-mono text-muted-foreground">
                                        {quote || "0.0"}
                                    </div>
                                    <div className="px-2 py-1 bg-background rounded text-xs font-bold">
                                        {swapDirection === "eth_to_ewt" ? "EWT" : "ETH"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSwap}
                            disabled={swapping || !swapAmount || !quote}
                            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                        >
                            {swapping ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Swapping...
                                </>
                            ) : (
                                "Swap"
                            )}
                        </button>

                        {swapStatus && (
                            <div className={`text-xs p-2 rounded-lg ${swapStatus.includes("✓") ? "bg-green-500/10 text-green-600" : swapStatus.includes("✗") ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>
                                {swapStatus}
                            </div>
                        )}
                    </div>
                )}

                {/* Send Tab */}
                {activeTab === "send" && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Recipient Address</label>
                            <input
                                type="text"
                                value={sendTo}
                                onChange={(e) => setSendTo(e.target.value)}
                                placeholder="0x..."
                                className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Amount (ETH)</label>
                            <input
                                type="number"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.0"
                                step="0.001"
                                className="w-full h-10 px-3 rounded-lg bg-muted border border-border text-sm font-mono"
                            />
                        </div>
                        {balances && (
                            <div className="text-xs text-muted-foreground">
                                Available: {formatBalance(balances.eth.balance)} ETH
                            </div>
                        )}
                        <button
                            onClick={handleSend}
                            disabled={sending || !sendTo || !sendAmount}
                            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                        >
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send ETH"
                            )}
                        </button>
                        {sendStatus && (
                            <div className={`text-xs p-2 rounded-lg ${sendStatus.includes("✓") ? "bg-green-500/10 text-green-600" : sendStatus.includes("✗") ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>
                                {sendStatus}
                            </div>
                        )}
                    </div>
                )}

                {/* Receive Tab */}
                {activeTab === "receive" && (
                    <div className="space-y-4 text-center">
                        <div className="p-4 bg-muted rounded-lg">
                            <div className="text-xs text-muted-foreground mb-2">Your Wallet Address</div>
                            <code className="text-xs font-mono break-all">{smartWallet}</code>
                        </div>
                        <button
                            onClick={copyAddress}
                            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90"
                        >
                            {copied ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    </svg>
                                    Copy Address
                                </>
                            )}
                        </button>
                        <div className="p-3 bg-yellow-500/10 rounded-lg text-xs text-yellow-600 dark:text-yellow-400">
                            💡 Send ETH or tokens to this address on Unichain Sepolia to fund your wallet.
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
