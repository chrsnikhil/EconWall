"use client";

import { useState, useEffect } from "react";
import {
    Wallet,
    X,
    Send,
    ArrowDownToLine,
    ArrowRightLeft,
    Copy,
    Check,
    ExternalLink,
    RefreshCw,
    History,
    UserCircle,
    Shield,
    ArrowUpRight
} from "lucide-react";
import { useBalance, useReadContract } from "wagmi";
import { formatEther, erc20Abi } from "viem";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ServerSwapCard } from "@/components/server-swap-card";
import WalletManager from "@/components/wallet-manager";

interface ServerWalletSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
    privyUserId: string | null;
}

type Tab = "ASSETS" | "SEND" | "RECEIVE" | "SWAP";

// --- Custom Token Logos ---

const EthLogo = () => (
    <svg viewBox="0 0 32 32" className="w-5 h-5" fill="currentColor">
        <path d="M16 1L4 21.1L16 28.2L28 21.1L16 1ZM16 2.4L26.3 19.6L16 25.6L5.7 19.6L16 2.4ZM16 29.6L4 22.1L16 31L28 22.1L16 29.6ZM16 27.2L6 21L16 15.1L25.9 21L16 27.2Z" />
    </svg>
);

const EwtLogo = () => (
    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-white">
        <span className="text-[10px] font-black tracking-[-0.1em] text-black">EW</span>
    </div>
);

export function ServerWalletSidebar({
    isOpen,
    onClose,
    walletAddress,
    privyUserId
}: ServerWalletSidebarProps) {
    const [activeTab, setActiveTab] = useState<Tab>("ASSETS");
    const [copied, setCopied] = useState(false);

    // Send state
    const [recipient, setRecipient] = useState("");
    const [sendAmount, setSendAmount] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);

    // Swap state
    const [swapAmount, setSwapAmount] = useState("0.01");
    const [isSwapping, setIsSwapping] = useState(false);
    const [swapStatus, setSwapStatus] = useState<"idle" | "success" | "error">("idle");
    const [swapMessage, setSwapMessage] = useState("");

    // Fetch Balances
    const ethBalance = useBalance({
        address: walletAddress as `0x${string}`,
        chainId: 1301,
    });

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
                    privyUserId,
                    recipient,
                    amount: sendAmount,
                })
            });
            const data = await res.json();
            if (res.ok) {
                setSendResult({ success: true, hash: data.txHash });
                setSendAmount("");
                setRecipient("");
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

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!walletAddress || isSwapping || !privyUserId) return;

        setIsSwapping(true);
        setSwapStatus("idle");
        setSwapMessage("");

        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    direction: "eth_to_ewt",
                    amount: swapAmount,
                    privyUserId: privyUserId
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Swap failed");

            setSwapStatus("success");
            setSwapMessage(`Swapped ${swapAmount} ETH for EWT! TX: ${data.txHash?.slice(0, 10)}...`);
            ethBalance.refetch();
            // @ts-ignore
            ewtBalance.refetch();
        } catch (err: any) {
            setSwapStatus("error");
            setSwapMessage(err.message || "Swap failed");
        } finally {
            setIsSwapping(false);
        }
    };

    // Close on escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 z-[100] transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar Container */}
            <div className={cn(
                "fixed top-0 right-0 h-full w-[400px] bg-black border-l border-white/10 z-[101] transition-transform duration-500 ease-out flex flex-col shadow-2xl",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-white/70" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight uppercase">EconWallet</h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Node 0x01</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/5 text-white/40 rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Account Section */}
                <div className="px-6 py-6 border-b border-white/5 space-y-4 bg-white/[0.02]">



                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                <UserCircle className="w-5 h-5 text-white/60" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Public Identity</span>
                                <span className="text-xs font-mono text-white/80">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
                            </div>
                        </div>
                        <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/10 text-white/40 transition-all">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="flex gap-2">
                        {(["ASSETS", "SEND", "RECEIVE", "SWAP"] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-2.5 text-[10px] font-bold tracking-[0.2em] transition-all rounded-lg border uppercase",
                                    activeTab === tab
                                        ? "bg-white text-black border-white"
                                        : "bg-transparent border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">

                    {/* ASSETS TAB */}
                    {activeTab === "ASSETS" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Total Value Locked</span>
                                <span className="text-4xl font-black text-white tracking-tighter">
                                    {parseFloat(formatEther(ethBalance.data?.value || 0n)).toFixed(4)} <span className="text-lg font-bold text-white/20 ml-1">ETH</span>
                                </span>
                                <div className="mt-5 flex items-center gap-2 pt-4 border-t border-white/5">
                                    <Shield className="w-3.5 h-3.5 text-white/30" />
                                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em]">Verified on Unichain Sepolia</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">Managed Assets</h3>

                                {/* ETH Row */}
                                <div className="h-20 p-5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/[0.07] transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 text-white">
                                            <EthLogo />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white uppercase tracking-tight">Ethereum</p>
                                            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">ETH</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{parseFloat(formatEther(ethBalance.data?.value || 0n)).toFixed(4)}</p>
                                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">--.-- USD</p>
                                    </div>
                                </div>

                                {/* EWT Row */}
                                <div className="h-20 p-5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/[0.07] transition-all group">
                                    <div className="flex items-center gap-4">
                                        <EwtLogo />
                                        <div>
                                            <p className="text-sm font-bold text-white uppercase tracking-tight">EconWall</p>
                                            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">EWT</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{parseFloat(formatEther((ewtBalance.data as bigint) || 0n)).toFixed(4)}</p>
                                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">--.-- USD</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">History</h3>
                                </div>
                                <div className="flex flex-col items-center justify-center py-12 text-white/5 rounded-xl border border-white/5">
                                    <History className="w-10 h-10 mb-3 opacity-20" />
                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em]">No Transactions</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SEND TAB */}
                    {activeTab === "SEND" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] mb-1">Transfer</h3>
                                <p className="text-[9px] text-white/30 leading-relaxed font-bold uppercase tracking-widest">Inbound/Outbound protocol request</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Destination Address</label>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-mono text-white focus:border-white/30 focus:bg-white/[0.07] focus:outline-none transition-all placeholder:text-white/10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Quantity (ETH)</label>
                                        <span className="text-[10px] text-white/20 font-bold uppercase">Max: {parseFloat(formatEther(ethBalance.data?.value || 0n)).toFixed(4)}</span>
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={sendAmount}
                                            onChange={(e) => setSendAmount(e.target.value)}
                                            className="w-full h-16 bg-white/5 border border-white/10 rounded-xl px-4 text-2xl font-bold text-white focus:border-white/30 focus:bg-white/[0.07] focus:outline-none transition-all placeholder:text-white/5"
                                        />
                                        <button
                                            onClick={() => setSendAmount(formatEther(ethBalance.data?.value || 0n))}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-black text-white/60 hover:text-white hover:bg-white/20 transition-all uppercase tracking-widest"
                                        >
                                            Max
                                        </button>
                                    </div>
                                </div>

                                {sendResult && (
                                    <div className={cn(
                                        "p-4 rounded-xl border flex items-start gap-4 animate-in fade-in bg-white/5",
                                        sendResult.success ? "border-white/20" : "border-white/10"
                                    )}>
                                        <div className="shrink-0 mt-1">
                                            {sendResult.success ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white/40" />}
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white">{sendResult.success ? "Success" : "Failed"}</p>
                                            <p className="text-[10px] font-mono break-all text-white/40">{sendResult.success ? sendResult.hash : sendResult.error}</p>
                                            {sendResult.success && (
                                                <a
                                                    href={`https://unichain-sepolia.blockscout.com/tx/${sendResult.hash}`}
                                                    target="_blank"
                                                    className="inline-flex items-center gap-2 text-[10px] font-black text-white hover:text-white/60 mt-1 uppercase tracking-[0.2em] border-b border-white/20 pb-0.5"
                                                >
                                                    View Status <ArrowUpRight className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleSend}
                                    disabled={isSending || !sendAmount || !recipient || !privyUserId}
                                    className="w-full h-16 rounded-xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-[0.3em] text-xs transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-4"
                                >
                                    {isSending ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            <span>Transmit Asset</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* RECEIVE TAB */}
                    {activeTab === "RECEIVE" && (
                        <div className="space-y-8 animate-in fade-in duration-300 flex flex-col items-center py-8 text-center">
                            <div className="space-y-3">
                                <h3 className="text-[12px] font-black text-white uppercase tracking-[0.5em]">Vault Inbound</h3>
                                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest leading-relaxed max-w-[260px]">Secure storage node address for Unichain Sepolia protocol.</p>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="p-8 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col items-center gap-6">
                                    <div className="space-y-3 w-full">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Protocol Identifier</span>
                                        <div className="p-5 bg-black border border-white/10 rounded-xl relative group">
                                            <span className="text-sm font-mono text-white/90 break-all leading-relaxed tracking-tight">{walletAddress}</span>
                                        </div>
                                    </div>
                                    <Button onClick={handleCopy} className="w-full h-16 rounded-xl bg-white text-black hover:bg-white/90 font-black uppercase text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-3">
                                        {copied ? <><Check className="w-5 h-5" /> Copied</> : <><Copy className="w-5 h-5" /> Copy ID</>}
                                    </Button>
                                </div>
                                <div className="p-4 border border-white/5 rounded-xl">
                                    <p className="text-[9px] text-white/20 uppercase font-black tracking-[0.3em] leading-relaxed">Warning: Only compatible with L2 Unichain Sepolia assets.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SWAP TAB */}
                    {activeTab === "SWAP" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] mb-1">Atom Exchange</h3>
                                <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Gasless Node Router Protocol</p>
                            </div>

                            <div className="space-y-1">
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6 relative">
                                    <div className="space-y-4">
                                        <div className="flex justify-between px-1">
                                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Source Input</span>
                                            <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">BAL: {parseFloat(formatEther(ethBalance.data?.value || 0n)).toFixed(4)}</span>
                                        </div>
                                        <div className="flex items-center gap-4 h-20 bg-black border border-white/10 rounded-xl px-4 focus-within:border-white/30 transition-all">
                                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                                <EthLogo />
                                            </div>
                                            <input
                                                type="number"
                                                value={swapAmount}
                                                onChange={(e) => setSwapAmount(e.target.value)}
                                                className="bg-transparent border-none text-3xl font-black text-white w-full focus:outline-none placeholder:text-white/5"
                                                placeholder="0.00"
                                            />
                                            <span className="text-[11px] font-black text-white uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">ETH</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-center -my-11 relative z-20">
                                        <div className="h-12 w-12 rounded-xl bg-black border border-white/20 flex items-center justify-center text-white shadow-2xl group ring-8 ring-black">
                                            <ArrowRightLeft className="w-5 h-5 rotate-90 group-hover:rotate-[270deg] transition-all duration-700" />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="flex justify-between px-1">
                                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Predicted Output</span>
                                            <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">BAL: {parseFloat(formatEther((ewtBalance.data as bigint) || 0n)).toFixed(4)}</span>
                                        </div>
                                        <div className="flex items-center gap-4 h-20 bg-black border border-white/10 rounded-xl px-4 opacity-50 cursor-not-allowed">
                                            <EwtLogo />
                                            <div className="text-3xl font-black text-white/40 w-full">{(parseFloat(swapAmount || "0") * 1000).toFixed(0)}</div>
                                            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">EWT</span>
                                        </div>
                                    </div>
                                </div>

                                {swapStatus !== "idle" && (
                                    <div className="p-4 rounded-xl border border-white/10 bg-white/5 animate-in zoom-in-95 mt-4 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{swapMessage}</p>
                                    </div>
                                )}

                                <Button
                                    onClick={handleSwap}
                                    disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0}
                                    className="w-full h-18 rounded-xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-[0.4em] text-xs transition-all active:scale-[0.98] mt-8 flex items-center justify-center gap-4 shadow-2xl"
                                >
                                    {isSwapping ? (
                                        <RefreshCw className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <ArrowRightLeft className="w-6 h-6" />
                                            <span>Exchange</span>
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="flex justify-between items-center p-6 rounded-xl border border-white/5 bg-white/[0.01]">
                                <div className="space-y-1.5">
                                    <p className="text-[9px] text-white/20 uppercase font-black tracking-[0.3em]">Protocol Fee</p>
                                    <p className="text-[11px] text-white font-black uppercase tracking-widest italic">Gasless L3</p>
                                </div>
                                <div className="text-right space-y-1.5">
                                    <p className="text-[9px] text-white/20 uppercase font-black tracking-[0.3em]">Network Routing</p>
                                    <p className="text-[11px] text-white font-black uppercase tracking-widest">Dynamic Optimised</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section with Wallet Manager */}
                <div className="border-t border-white/5 bg-white/[0.01]">
                    <div className="p-6">
                        <WalletManager />
                    </div>

                    <div className="pb-8 px-8 flex flex-col items-center gap-3 grayscale opacity-50">
                        <div className="flex items-center gap-3">
                            <Shield className="w-4 h-4 text-white" />
                            <p className="text-[10px] text-white tracking-[0.4em] font-black uppercase">Secure Protocol Layer</p>
                        </div>
                        <p className="text-[9px] text-white/20 font-mono tracking-[0.3em] font-black uppercase">NODE_ID: {privyUserId?.slice(-16).toUpperCase() || "NO_AUTH"}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
