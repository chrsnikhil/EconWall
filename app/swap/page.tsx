
import { SwapCard } from "@/components/swap-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectWallet } from "@/components/connect-wallet";
import Link from "next/link";

export default function SwapPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="w-full px-6 py-6 flex items-center justify-between animate-slide-in-down relative z-10">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity">
                        ECONWALL
                        <span className="text-muted-foreground text-sm font-normal ml-2">/ SWAP</span>
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <ConnectWallet />
                    <ThemeToggle />
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-6">
                <SwapCard />
            </main>
        </div>
    );
}
