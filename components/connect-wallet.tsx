"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";

interface ArcWallet {
    id: string;
    address: string;
    blockchain: string;
    state: string;
    balances: Array<{
        token: { symbol: string };
        amount: string;
    }>;
}

export function ConnectWallet() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    const [arcWallet, setArcWallet] = useState<ArcWallet | null>(null);
    const [loading, setLoading] = useState(false);
    const [isNew, setIsNew] = useState(false);

    // When MetaMask connects, fetch/create Arc wallet
    useEffect(() => {
        if (isConnected && address) {
            fetchArcWallet(address);
        } else {
            setArcWallet(null);
        }
    }, [isConnected, address]);

    const fetchArcWallet = async (metamaskAddress: string) => {
        setLoading(true);
        try {
            const res = await fetch("/api/wallet/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metamaskAddress }),
            });
            const data = await res.json();

            if (data.success) {
                setArcWallet(data.wallet);
                setIsNew(data.isNew);
            }
        } catch (error) {
            console.error("Failed to fetch Arc wallet:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Not connected state
    if (!isConnected) {
        return (
            <button
                onClick={() => connect({ connector: connectors[0] })}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all duration-300 flex items-center gap-2"
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
                    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                Connect
            </button>
        );
    }

    // Connected state
    return (
        <div className="flex items-center gap-3">
            {/* Arc Wallet Badge */}
            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Linking...</span>
                </div>
            ) : arcWallet ? (
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => copyToClipboard(arcWallet.address)}
                    title="Click to copy Arc wallet address"
                >
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-xs text-muted-foreground">Arc</span>
                            <span className="text-sm font-mono text-foreground">
                                {formatAddress(arcWallet.address)}
                            </span>
                        </div>
                        {arcWallet.balances.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {parseFloat(arcWallet.balances[0].amount).toFixed(2)} {arcWallet.balances[0].token?.symbol}
                            </span>
                        )}
                    </div>
                    {isNew && (
                        <span className="text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">NEW</span>
                    )}
                </div>
            ) : null}

            {/* MetaMask Address + Disconnect */}
            <div className="flex items-center gap-2">
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => copyToClipboard(address!)}
                    title="Click to copy MetaMask address"
                >
                    <svg width="16" height="16" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32.958 1L19.514 11.218l2.49-5.882L32.958 1z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.042 1l13.314 10.313-2.36-5.977L2.042 1zM28.146 23.533l-3.576 5.474 7.652 2.105 2.195-7.447-6.271-.132zM.583 23.665l2.184 7.447 7.652-2.105-3.576-5.474-6.26.132z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm font-mono text-foreground">
                        {formatAddress(address!)}
                    </span>
                </div>
                <button
                    onClick={() => disconnect()}
                    className="h-9 w-9 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    title="Disconnect"
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
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
