"use client";

import { useState } from "react";
import { useBalance, useReadContract } from "wagmi";
import { Copy, Wallet, RefreshCw, ArrowDownToLine, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatEther, erc20Abi } from "viem";


export function ServerWalletView({ walletAddress, privyUserId }: { walletAddress: string, privyUserId: string | null }) {
    const [copied, setCopied] = useState(false);
    const [mode, setMode] = useState<"VIEW" | "SEND" | "RECEIVE">("VIEW");

    // Send State
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);

    // Fetch ETH Balance
    const ethBalance = useBalance({
        address: walletAddress as `0x${string}`,
        chainId: 1301, // Unichain Sepolia
    });

    // Fetch EWT Token Balance
    const ewtBalance = useReadContract({
        address: "0x312cf8c8f041df4444a19e0525452ae362f3b043", // EWT Address
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
        chainId: 1301,
    });

    const handleCopy = () => {
        navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSend = async () => {
        if (!privyUserId) return;
        setIsSending(true);
        setSendResult(null);

        try {
            const res = await fetch("/api/wallet/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    privyUserId: privyUserId,
                    recipient: recipient,
                    amount: amount,
                })
            });
            const data = await res.json();

            if (res.ok) {
                setSendResult({ success: true, hash: data.txHash });
                setAmount("");
                setRecipient("");
                // Refresh balances? Wagmi usually auto-refreshes on block, or we can force refetch
                ethBalance.refetch();
            } else {
                setSendResult({ success: false, error: data.error || "Send failed" });
            }
        } catch (err: any) {
            setSendResult({ success: false, error: err.message });
        } finally {
            setIsSending(false);
        }
    };

    const isLoading = ethBalance.isLoading || ewtBalance.isLoading;

    return (
        <Card className="w-full max-w-md animate-scale-in border-purple-500/30 bg-black/40 backdrop-blur-md shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] relative overflow-hidden group">
            {/* Decorative Gradients */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-green-500/20 rounded-full blur-3xl group-hover:bg-green-500/30 transition-all duration-700" />

            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">
                    <Wallet className="w-5 h-5 text-purple-400" />
                    Server Managed Wallet
                </CardTitle>
                <CardDescription>
                    Persistent wallet on Unichain Sepolia.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 relative z-10">

                {/* Mode: VIEW */}
                {mode === "VIEW" && (
                    <>
                        {/* Address Card */}
                        <div className="p-4 bg-muted/50 rounded-xl border border-white/5 flex items-center justify-between gap-3 group/field hover:border-purple-500/30 transition-all">
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Wallet Address</span>
                                <span className="font-mono text-sm truncate text-foreground">{walletAddress}</span>
                            </div>
                            <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-purple-400 transition-colors">
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Balances */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20 text-center">
                                <span className="text-xs text-green-400/80 font-medium block mb-1">ETH Balance</span>
                                <span className="text-xl font-bold text-green-400">
                                    {parseFloat(formatEther(ethBalance.data?.value || 0n)).toFixed(4)}
                                </span>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/20 text-center">
                                <span className="text-xs text-purple-400/80 font-medium block mb-1">EWT Balance</span>
                                <span className="text-xl font-bold text-purple-400">
                                    {parseFloat(formatEther((ewtBalance.data as bigint) || 0n)).toFixed(0)}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode("SEND")}
                                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all flex items-center justify-center gap-2"
                            >
                                Send
                            </button>
                            <button
                                onClick={handleCopy}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowDownToLine className="w-4 h-4" />
                                Deposit / Receive
                            </button>
                        </div>
                    </>
                )}

                {/* Mode: SEND */}
                {mode === "SEND" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-purple-300">Send ETH</h3>
                            <button onClick={() => setMode("VIEW")} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Recipient Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-purple-500/50 outline-none text-sm font-mono text-white placeholder:text-gray-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Amount (ETH)</label>
                            <input
                                type="number"
                                placeholder="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-purple-500/50 outline-none text-sm font-mono text-white placeholder:text-gray-600"
                            />
                        </div>

                        {sendResult && (
                            <div className={`p-3 rounded-lg text-xs break-all ${sendResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {sendResult.success ? (
                                    <>Sent! Hash: <a href={`https://sepolia.uniscan.xyz/tx/${sendResult.hash}`} target="_blank" className="underline font-mono ml-1">{sendResult.hash?.slice(0, 10)}...</a></>
                                ) : (
                                    sendResult.error
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={isSending || !amount || !recipient || !privyUserId}
                            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all mt-2 flex items-center justify-center gap-2"
                        >
                            {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirm Send"}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
