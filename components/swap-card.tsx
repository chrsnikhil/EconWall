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

    const { data: ewtBalance, refetch: refetchEwtBalance } = useReadContract({
        address: CUSTOM_TOKEN_ADDRESS,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [walletAddress!],
        query: { enabled: !!walletAddress, refetchInterval: 5000 }
    });

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
        addLog(`Polling ${actionName}...`);
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            const res = await fetch(`/api/wallet/transfer?transactionId=${txId}`);
            const data = await res.json();

            if (data.success && data.transaction) {
                const state = data.transaction.state;
                if (state === "COMPLETE") {
                    addLog(`${actionName} confirmed`);
                    return true;
                }
                if (state === "FAILED" || state === "CANCELLED") {
                    throw new Error(`${actionName} failed: ${state}`);
                }
            }
            attempts++;
        }
        throw new Error(`${actionName} timed out`);
    };

    const handleSwap = async () => {
        if (!amount || !walletId) return;
        setStatus("Approving");
        setLogs([]);
        addLog(`Starting swap...`);

        try {
            const decimals = direction === "USDC_TO_EWT" ? 6 : 18;
            const amountInWei = parseUnits(amount, decimals).toString();

            const approveEndpoint = direction === "USDC_TO_EWT" ? "/api/swap/approve" : "/api/swap/approve-ewt";
            addLog("Approving tokens...");
            const approveRes = await fetch(approveEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const approveData = await approveRes.json();
            if (!approveData.id) throw new Error(approveData.error || "Approval failed");

            await pollTransaction(approveData.id, "Approval");

            setStatus("Swapping");
            const executeEndpoint = direction === "USDC_TO_EWT" ? "/api/swap/execute" : "/api/swap/execute-reverse";
            addLog("Executing swap...");
            const swapRes = await fetch(executeEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const swapData = await swapRes.json();
            if (!swapData.id) throw new Error(swapData.error || "Swap failed");

            await pollTransaction(swapData.id, "Swap");

            setStatus("Success");
            setAmount("");
            addLog("Swap complete");
            refetchEwtBalance();
            refetchUsdcBalance();
            if (walletId) fetchSwapStats(walletId);

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
            <Card className="w-full max-w-sm mx-auto">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Connect Wallet</CardTitle>
                    <CardDescription className="text-xs">Connect to Arc Testnet</CardDescription>
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
        <Card className="w-full max-w-sm mx-auto">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Swap</CardTitle>
                <CardDescription className="text-xs font-mono truncate">
                    {walletId ? walletId : "Loading..."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Balances */}
                {walletAddress && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 bg-muted rounded text-center">
                            <div className="text-xs text-muted-foreground">USDC</div>
                            <div className="font-mono font-medium">
                                {usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2) : "0.00"}
                            </div>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                            <div className="text-xs text-muted-foreground">EWT</div>
                            <div className="font-mono font-medium">
                                {ewtBalance ? parseFloat(formatUnits(ewtBalance, 18)).toFixed(2) : "0.00"}
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {swapStats && (
                    <div className="text-xs text-muted-foreground flex justify-between px-1">
                        <span>Swaps: {swapStats.totalSwaps}</span>
                        <span>Last hour: {swapStats.swapsLastHour}</span>
                    </div>
                )}

                {/* Direction Toggle */}
                <button
                    onClick={toggleDirection}
                    disabled={status === "Approving" || status === "Swapping"}
                    className="w-full py-2 text-sm bg-muted hover:bg-muted/80 rounded flex items-center justify-center gap-3 transition-colors"
                >
                    <span className="font-medium">{fromToken}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{toToken}</span>
                </button>

                {/* Input */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            disabled={status === "Approving" || status === "Swapping"}
                            className="w-full h-10 px-3 pr-16 rounded bg-muted border-0 font-mono text-sm focus:ring-1 focus:ring-primary"
                        />
                        <div className="absolute right-3 top-2.5 text-xs text-muted-foreground">{fromToken}</div>
                    </div>
                </div>

                {/* Rate */}
                <div className="text-xs text-muted-foreground text-center">
                    1 {fromToken} ≈ 0.99 {toToken}
                </div>

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={!walletId || !amount || status === "Approving" || status === "Swapping"}
                    className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                    {status === "Approving" || status === "Swapping" ? (
                        <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {status}...
                        </>
                    ) : status === "Success" ? "Swap Again" : "Swap"}
                </button>

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="p-2 bg-muted/50 rounded text-xs font-mono space-y-0.5 max-h-24 overflow-y-auto">
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
