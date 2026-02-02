"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ConnectWallet } from "@/components/connect-wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ERC20ABI } from "@/lib/abis";

const CUSTOM_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

type SwapDirection = "USDC_TO_EWT" | "EWT_TO_USDC";

export function SwapCard() {
    const { address, isConnected } = useAccount();
    const [amount, setAmount] = useState<string>("");
    const [direction, setDirection] = useState<SwapDirection>("USDC_TO_EWT");
    const [status, setStatus] = useState<string>("");
    const [walletId, setWalletId] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [swapStats, setSwapStats] = useState<{
        totalSwaps: number;
        swapsLastMinute: number;
        swapsLastHour: number;
    } | null>(null);

    useEffect(() => {
        if (isConnected && address) {
            fetchWalletId(address);
        } else {
            setWalletId(null);
            setWalletAddress(null);
        }
    }, [isConnected, address]);

    // Read EWT Balance
    const { data: ewtBalance, refetch: refetchEwtBalance } = useReadContract({
        address: CUSTOM_TOKEN_ADDRESS,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [walletAddress!],
        query: { enabled: !!walletAddress, refetchInterval: 5000 }
    });

    // Read USDC Balance
    const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [walletAddress!],
        query: { enabled: !!walletAddress, refetchInterval: 5000 }
    });

    const fetchWalletId = async (addr: string) => {
        try {
            const res = await fetch("/api/wallet/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metamaskAddress: addr }),
            });
            const data = await res.json();
            if (data.success && data.wallet?.id) {
                setWalletId(data.wallet.id);
                setWalletAddress(data.wallet.address as `0x${string}`);
                // Fetch swap stats after getting wallet ID
                fetchSwapStats(data.wallet.id);
            }
        } catch (e) {
            console.error("Failed to fetch wallet ID", e);
        }
    };

    const fetchSwapStats = async (wId: string) => {
        try {
            const res = await fetch(`/api/swap/history?walletId=${wId}`);
            const data = await res.json();
            if (data.success && data.stats) {
                setSwapStats(data.stats);
            }
        } catch (e) {
            console.error("Failed to fetch swap stats", e);
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const pollTransaction = async (txId: string, actionName: string) => {
        addLog(`Polling ${actionName} status...`);
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            const res = await fetch(`/api/wallet/transfer?transactionId=${txId}`);
            const data = await res.json();

            if (data.success && data.transaction) {
                const state = data.transaction.state;
                if (state === "COMPLETE") {
                    addLog(`${actionName} Confirmed!`);
                    return true;
                }
                if (state === "FAILED" || state === "CANCELLED") {
                    throw new Error(`${actionName} Failed: ${state}`);
                }
            }
            attempts++;
        }
        throw new Error(`${actionName} Timed Out`);
    };

    const handleSwap = async () => {
        if (!amount || !walletId) return;
        setStatus("Approving");
        setLogs([]);
        addLog(`Starting ${direction === "USDC_TO_EWT" ? "USDC → EWT" : "EWT → USDC"} Swap...`);

        try {
            const decimals = direction === "USDC_TO_EWT" ? 6 : 18;
            const amountInWei = parseUnits(amount, decimals).toString();

            // 1. Approve
            const approveEndpoint = direction === "USDC_TO_EWT" ? "/api/swap/approve" : "/api/swap/approve-ewt";
            addLog("Step 1: Approving...");
            const approveRes = await fetch(approveEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const approveData = await approveRes.json();
            if (!approveData.id) throw new Error(approveData.error || "Approval Failed");

            addLog(`Approval Sent (ID: ${approveData.id}). Waiting...`);
            await pollTransaction(approveData.id, "Approval");

            // 2. Execute Swap
            setStatus("Swapping");
            const executeEndpoint = direction === "USDC_TO_EWT" ? "/api/swap/execute" : "/api/swap/execute-reverse";
            addLog("Step 2: Executing Swap...");
            const swapRes = await fetch(executeEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const swapData = await swapRes.json();
            if (!swapData.id) throw new Error(swapData.error || "Swap Execution Failed");

            addLog(`Swap Sent (ID: ${swapData.id}). Waiting...`);
            await pollTransaction(swapData.id, "Swap");

            setStatus("Success");
            setAmount("");
            addLog("Swap Successful! Updating balances...");
            refetchEwtBalance();
            refetchUsdcBalance();
            if (walletId) fetchSwapStats(walletId); // Refresh swap stats

        } catch (e: any) {
            console.error(e);
            setStatus("Error");
            addLog(`Error: ${e.message}`);
        }
    };

    const toggleDirection = () => {
        setDirection(prev => prev === "USDC_TO_EWT" ? "EWT_TO_USDC" : "USDC_TO_EWT");
        setAmount("");
    };

    if (!isConnected) {
        return (
            <Card className="w-full max-w-md mx-auto animate-scale-in">
                <CardHeader>
                    <CardTitle>Connect Wallet</CardTitle>
                    <CardDescription>Connect to Arc Testnet to swap</CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectWallet />
                </CardContent>
            </Card>
        );
    }

    const fromToken = direction === "USDC_TO_EWT" ? "USDC" : "EWT";
    const toToken = direction === "USDC_TO_EWT" ? "EWT" : "USDC";

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg animate-fade-in border-primary/20">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                    🔄 Swap {fromToken} to {toToken}
                </CardTitle>
                <CardDescription>
                    Using Circle Developer Wallet <br />
                    <span className="font-mono text-xs text-muted-foreground">{walletId ? `ID: ${walletId}` : "Fetching Wallet..."}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Balance Display */}
                {walletAddress && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
                            <span className="text-xs text-muted-foreground block">USDC Balance</span>
                            <span className="text-lg font-bold font-mono">
                                {usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2) : "0.00"}
                            </span>
                        </div>
                        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
                            <span className="text-xs text-muted-foreground block">EWT Balance</span>
                            <span className="text-lg font-bold font-mono">
                                {ewtBalance ? parseFloat(formatUnits(ewtBalance, 18)).toFixed(2) : "0.00"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Swap Stats */}
                {swapStats && (
                    <div className="p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                        <div className="text-xs text-muted-foreground mb-2 font-medium">📊 Your Swap Activity</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <span className="text-lg font-bold block">{swapStats.totalSwaps}</span>
                                <span className="text-xs text-muted-foreground">Total</span>
                            </div>
                            <div>
                                <span className="text-lg font-bold block">{swapStats.swapsLastHour}</span>
                                <span className="text-xs text-muted-foreground">Last Hour</span>
                            </div>
                            <div>
                                <span className="text-lg font-bold block">{swapStats.swapsLastMinute}</span>
                                <span className="text-xs text-muted-foreground">Last Min</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Direction Toggle */}
                <button
                    onClick={toggleDirection}
                    disabled={status === "Approving" || status === "Swapping"}
                    className="w-full py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                    <span className="font-medium">{fromToken}</span>
                    <span className="text-lg">⇄</span>
                    <span className="font-medium">{toToken}</span>
                </button>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Amount ({fromToken})</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            disabled={status === "Approving" || status === "Swapping"}
                            className="w-full h-12 px-4 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary transition-all font-mono text-lg"
                        />
                        <div className="absolute right-4 top-3 text-sm font-bold text-muted-foreground">{fromToken}</div>
                    </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg text-sm flex justify-between">
                    <span>Rate</span>
                    <span>1 {fromToken} ≈ 0.99 {toToken} (1% fee)</span>
                </div>

                <button
                    onClick={handleSwap}
                    disabled={!walletId || !amount || status === "Approving" || status === "Swapping"}
                    className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
                >
                    {status === "Approving" || status === "Swapping" ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            {status}...
                        </>
                    ) : status === "Success" ? "Swap Another" : `Swap ${fromToken} → ${toToken}`}
                </button>

                {logs.length > 0 && (
                    <div className="mt-4 p-3 bg-black/5 rounded-md text-xs font-mono space-y-1 max-h-32 overflow-y-auto border border-border">
                        {logs.map((log, i) => (
                            <div key={i} className={log.includes("Error") ? "text-red-500" : "text-muted-foreground"}>
                                {log}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
