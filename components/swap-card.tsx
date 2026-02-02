"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ConnectWallet } from "@/components/connect-wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ERC20ABI } from "@/lib/abis";

const CUSTOM_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;

export function SwapCard() {
    const { address, isConnected } = useAccount();
    const [amount, setAmount] = useState<string>("");
    const [status, setStatus] = useState<string>(""); // "Idle", "Approving", "Swapping", "Success", "Error"
    const [walletId, setWalletId] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // Fetch Circle Wallet ID
    useEffect(() => {
        if (isConnected && address) {
            fetchWalletId(address);
        } else {
            setWalletId(null);
            setWalletAddress(null);
        }
    }, [isConnected, address]);

    // Read EWT Balance directly from chain
    const { data: ewtBalance, refetch: refetchBalance } = useReadContract({
        address: CUSTOM_TOKEN_ADDRESS,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [walletAddress!],
        query: {
            enabled: !!walletAddress,
            refetchInterval: 5000,
        }
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
            }
        } catch (e) {
            console.error("Failed to fetch wallet ID", e);
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const pollTransaction = async (txId: string, actionName: string) => {
        addLog(`Polling ${actionName} status...`);
        let attempts = 0;
        const maxAttempts = 30; // 60s max

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
                // Continue polling if PENDING / CONFIRMED etc
            }
            attempts++;
        }
        throw new Error(`${actionName} Timed Out`);
    };

    const handleSwap = async () => {
        if (!amount || !walletId) return;
        setStatus("Approving");
        setLogs([]);
        addLog("Starting Swap Process...");

        try {
            const amountInWei = parseUnits(amount, 6).toString(); // USDC 6 decimals

            // 1. Approve
            addLog("Step 1: Approving Router...");
            const approveRes = await fetch("/api/swap/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const approveData = await approveRes.json();
            if (!approveData.id) throw new Error(approveData.error || "Approval Failed");

            addLog(`Approval Sent (ID: ${approveData.id}). Waiting for confirmation...`);
            await pollTransaction(approveData.id, "Approval");

            // 2. Execute Swap (Now safe to execute)
            setStatus("Swapping");
            addLog("Step 2: Executing Swap...");
            const swapRes = await fetch("/api/swap/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, amount: amountInWei }),
            });
            const swapData = await swapRes.json();
            if (!swapData.id) throw new Error(swapData.error || "Swap Execution Failed");

            addLog(`Swap Sent (ID: ${swapData.id}). Waiting for confirmation...`);
            await pollTransaction(swapData.id, "Swap");

            setStatus("Success");
            setAmount("");
            addLog("Swap Successful! Updating balance...");
            refetchBalance();

        } catch (e: any) {
            console.error(e);
            setStatus("Error");
            addLog(`Error: ${e.message}`);
        }
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

    return (
        <Card className="w-full max-w-md mx-auto shadow-lg animate-fade-in border-primary/20">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                    🔄 Swap USDC to EWT
                </CardTitle>
                <CardDescription>
                    Using Circle Developer Wallet <br />
                    <span className="font-mono text-xs text-muted-foreground">{walletId ? `ID: ${walletId}` : "Fetching Wallet..."}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Balance Display */}
                {walletAddress && (
                    <div className="p-3 bg-secondary/50 rounded-lg flex justify-between items-center border border-border">
                        <span className="text-sm font-medium">Your EWT Balance:</span>
                        <span className="text-lg font-bold font-mono">
                            {ewtBalance ? parseFloat(formatUnits(ewtBalance, 18)).toFixed(2) : "0.00"} EWT
                        </span>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (USDC)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            disabled={status === "Approving" || status === "Swapping"}
                            className="w-full h-12 px-4 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary transition-all font-mono text-lg"
                        />
                        <div className="absolute right-4 top-3 text-sm font-bold text-muted-foreground">USDC</div>
                    </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg text-sm flex justify-between">
                    <span>Rate</span>
                    <span>1 USDC ≈ 1 EWT</span>
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
                    ) : status === "Success" ? "Swap Another" : "Swap Tokens"}
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
