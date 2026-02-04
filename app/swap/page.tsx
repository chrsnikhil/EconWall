"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export default function SwapPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("Idle");
    const [txHash, setTxHash] = useState("");

    const { address } = useAccount();

    const handleSwap = async () => {
        try {
            if (!address) throw new Error("Wallet not connected");

            setLoading(true);
            setStatus("Swapping & Forwarding to your Wallet...");

            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    direction: "eth_to_ewt",
                    amount: "0.001",
                    sender: address // Send EOA for direct forwarding
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Swap Failed");
            }

            setStatus("Success!");
            setTxHash(data.txHash);
        } catch (err: any) {
            console.error(err);
            setStatus("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
            <h1 className="text-2xl font-bold">Direct EOA Swap</h1>
            <div className="p-4 border rounded-xl bg-card text-card-foreground shadow w-full max-w-md">
                <div className="flex justify-between mb-4">
                    <span>From: ETH</span>
                    <span>To: EWT</span>
                </div>
                <button
                    onClick={handleSwap}
                    disabled={loading}
                    className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
                >
                    {loading ? "Swapping..." : "Swap 0.001 ETH"}
                </button>

                {status && <div className="mt-4 text-sm text-center font-mono">{status}</div>}
                {txHash && (
                    <div className="mt-2 text-xs text-center break-all text-green-500">
                        TX: {txHash}
                    </div>
                )}
            </div>
        </div>
    );
}
