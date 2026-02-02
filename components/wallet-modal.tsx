"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

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

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = "assets" | "activity" | "send" | "receive";

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const { address, isConnected } = useAccount();
    const [wallet, setWallet] = useState<WalletDetails | null>(null);
    const [balances, setBalances] = useState<TokenBalance[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("assets");

    // Send form state
    const [sendAddress, setSendAddress] = useState("");
    const [sendAmount, setSendAmount] = useState("");
    const [sendToken, setSendToken] = useState("USDC");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    // Copy state
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && isConnected && address) {
            fetchWalletDetails(address);
        }
    }, [isOpen, isConnected, address]);

    const fetchWalletDetails = async (metamaskAddress: string) => {
        setLoading(true);
        try {
            const connectRes = await fetch("/api/wallet/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metamaskAddress }),
            });
            const connectData = await connectRes.json();

            if (!connectData.success) return;

            const walletId = connectData.wallet.id;
            const detailsRes = await fetch(`/api/wallet/details?walletId=${walletId}`);
            const detailsData = await detailsRes.json();

            if (detailsData.success) {
                setWallet(detailsData.wallet);
                setBalances(detailsData.balances);
                setTransactions(detailsData.transactions);
            }
        } catch (err) {
            console.error("Failed to fetch wallet:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openArcScan = (path: string) => {
        window.open(`https://testnet.arcscan.app/${path}`, "_blank");
    };

    const pollTransactionStatus = async (transactionId: string) => {
        const maxAttempts = 30; // Max 60 seconds of polling
        let attempts = 0;

        const poll = async () => {
            attempts++;
            try {
                const res = await fetch(`/api/wallet/transfer?transactionId=${transactionId}`);
                const data = await res.json();

                if (data.success && data.transaction) {
                    const state = data.transaction.state;
                    setSendResult({ success: true, message: `Transaction ${state.toLowerCase()}...` });

                    if (state === "COMPLETE") {
                        setSendResult({ success: true, message: "Transaction complete!" });
                        // Reset and refresh after showing success
                        setTimeout(() => {
                            if (address) fetchWalletDetails(address);
                            setActiveTab("activity");
                            setSendResult(null);
                            setSending(false);
                        }, 1500);
                        return;
                    } else if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") {
                        setSendResult({ success: false, message: `Transaction ${state.toLowerCase()}` });
                        setSending(false);
                        return;
                    }
                }

                // Continue polling if not complete
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000);
                } else {
                    setSendResult({ success: true, message: "Transaction pending. Check Activity tab." });
                    setSending(false);
                    if (address) fetchWalletDetails(address);
                }
            } catch {
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000);
                } else {
                    setSending(false);
                }
            }
        };

        poll();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wallet || !sendAddress || !sendAmount) return;

        setSending(true);
        setSendResult(null);

        try {
            const res = await fetch("/api/wallet/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    senderAddress: wallet.address,
                    destinationAddress: sendAddress,
                    amount: sendAmount,
                    token: sendToken,
                }),
            });

            const data = await res.json();

            if (data.success) {
                const transactionId = data.transaction?.transaction?.id;
                setSendAddress("");
                setSendAmount("");
                setSendToken("USDC");

                if (transactionId) {
                    setSendResult({ success: true, message: "Transaction initiated..." });
                    pollTransactionStatus(transactionId);
                } else {
                    setSendResult({ success: true, message: "Transaction submitted!" });
                    setTimeout(() => {
                        if (address) fetchWalletDetails(address);
                        setActiveTab("activity");
                        setSendResult(null);
                        setSending(false);
                    }, 2000);
                }
            } else {
                setSendResult({ success: false, message: data.error || "Transfer failed" });
                setSending(false);
            }
        } catch (err) {
            setSendResult({ success: false, message: err instanceof Error ? err.message : "Transfer failed" });
            setSending(false);
        }
    };


    const getBalance = (symbol: string) => {
        const balance = balances.find(b => b.token?.symbol === symbol);
        return balance ? parseFloat(balance.amount) : 0;
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed right-4 top-4 bottom-4 w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        </div>
                        <div>
                            <div className="font-semibold text-foreground">Arc Wallet</div>
                            <div className="text-xs text-muted-foreground">
                                {wallet ? formatAddress(wallet.address) : "Loading..."}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => address && fetchWalletDetails(address)}
                            disabled={loading}
                            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-50"
                            title="Refresh wallet"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" x2="6" y1="6" y2="18" />
                                <line x1="6" x2="18" y1="6" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>


                {/* Tabs */}
                <div className="flex border-b border-border">
                    {(["assets", "send", "receive", "activity"] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-xs font-medium capitalize ${activeTab === tab
                                ? "text-foreground border-b-2 border-primary"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-6 w-6 text-muted-foreground" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    ) : activeTab === "assets" ? (
                        <div className="space-y-3">
                            {balances.length > 0 ? (
                                balances.map((balance, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold">
                                                {balance.token?.symbol?.charAt(0) || "$"}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{balance.token?.name || "Token"}</div>
                                                <div className="text-xs text-muted-foreground">{balance.token?.symbol}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">
                                                {parseFloat(balance.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                                            <path d="M12 18V6" />
                                        </svg>
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-2">No tokens yet</p>
                                    <p className="text-xs text-muted-foreground">
                                        Go to Receive tab to see your address
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === "send" ? (
                        <form onSubmit={handleSend} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Token</label>
                                <div className="flex gap-2">
                                    {["USDC", "EURC"].map((token) => (
                                        <button
                                            key={token}
                                            type="button"
                                            onClick={() => setSendToken(token)}
                                            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium ${sendToken === token
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                }`}
                                        >
                                            {token}
                                            <span className="ml-1 opacity-60">
                                                ({getBalance(token).toFixed(2)})
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Recipient Address</label>
                                <input
                                    type="text"
                                    value={sendAddress}
                                    onChange={(e) => setSendAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Amount</label>
                                <input
                                    type="number"
                                    value={sendAmount}
                                    onChange={(e) => setSendAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                />
                            </div>

                            {sendResult && (
                                <div className={`p-3 rounded-xl text-sm ${sendResult.success ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
                                    {sendResult.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={sending || !sendAddress || !sendAmount}
                                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="22" x2="11" y1="2" y2="13" />
                                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                        Send {sendToken}
                                    </>
                                )}
                            </button>
                        </form>
                    ) : activeTab === "receive" ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500">
                                        <path d="M12 22V8" />
                                        <path d="m5 15 7 7 7-7" />
                                        <path d="M18 3H6" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-lg mb-1">Receive Tokens</h3>
                                <p className="text-sm text-muted-foreground">
                                    Send tokens to your Arc wallet address
                                </p>
                            </div>

                            {wallet && (
                                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                                    <div className="text-xs text-muted-foreground mb-2">Your Arc Address</div>
                                    <div className="font-mono text-sm break-all mb-3">
                                        {wallet.address}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(wallet.address)}
                                        className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                </svg>
                                                Copy Address
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="p-3 rounded-xl bg-muted/30 border border-border">
                                <div className="flex items-start gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground mt-0.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                    </svg>
                                    <div className="text-xs text-muted-foreground">
                                        This is an Arc Testnet address. Use the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Circle Faucet</a> to get free testnet USDC.
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.length > 0 ? (
                                transactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer"
                                        onClick={() => tx.txHash && openArcScan(`tx/${tx.txHash}`)}
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
                                                <div className="font-medium text-sm">
                                                    {tx.type === "OUTBOUND" ? "Sent" : "Received"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(tx.createDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div
                                                className={`font-semibold text-sm ${tx.type === "OUTBOUND" ? "text-red-500" : "text-green-500"
                                                    }`}
                                            >
                                                {tx.type === "OUTBOUND" ? "-" : "+"}
                                                {tx.amounts?.[0] || "0"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{tx.state}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" x2="8" y1="13" y2="13" />
                                            <line x1="16" x2="8" y1="17" y2="17" />
                                        </svg>
                                    </div>
                                    <p className="text-muted-foreground text-sm">No transactions yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border">
                    <div className="text-xs text-muted-foreground text-center">
                        Arc Testnet • {wallet?.state || "Loading"}
                    </div>
                </div>
            </div>
        </>
    );
}
