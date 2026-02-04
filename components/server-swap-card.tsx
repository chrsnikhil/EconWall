"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ServerSwapCard({ userAddress }: { userAddress: string }) {
    const [amount, setAmount] = useState("0.001");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userAddress || loading) return;

        setLoading(true);
        setStatus("idle");
        setMessage("");

        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    direction: "eth_to_ewt",
                    amount: amount,
                    sender: userAddress
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Swap failed");
            }

            setStatus("success");
            setMessage(`Swapped ${amount} ETH for EWT!`);
        } catch (err: any) {
            setStatus("error");
            setMessage(err.message || "Swap failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md animate-scale-in border-blue-500/30 bg-black/40 backdrop-blur-md shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] relative overflow-hidden mt-4">
            {/* Decorative Blob */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg text-blue-400">
                    <ArrowRightLeft className="w-5 h-5" />
                    Quick Swap
                </CardTitle>
                <CardDescription>
                    Use your Server Wallet to trade ETH for EWT tokens.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSwap} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (ETH)</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.0001"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full h-12 pl-4 pr-16 rounded-xl bg-muted/50 border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-lg"
                                placeholder="0.001"
                                required
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                                ETH
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Signing...
                            </>
                        ) : (
                            "Swap Now"
                        )}
                    </button>

                    {/* Feedback Messages */}
                    {status === "success" && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-400 text-sm animate-fade-in">
                            <CheckCircle className="w-4 h-4" />
                            {message}
                        </div>
                    )}
                    {status === "error" && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400 text-sm animate-fade-in">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
