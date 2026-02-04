"use client";

import { useState, FormEvent, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/connect-wallet";
import { ServerWalletSidebar } from "@/components/server-wallet-sidebar";
import Link from "next/link";
import { resolveEnsWithCcip } from "@/lib/ccip-read";
import { Hex } from "viem";
import { Wallet } from "lucide-react";

type AppState = "IDLE" | "CHECKING" | "DENIED" | "BROWSER";

// Real Custom Resolver on Sepolia
const RESOLVER_ADDRESS = "0xb4e2ed5879b924e971a3A61FAF7Cb0d2d88bB982";

export default function Home() {
  // Use Privy for authentication and embedded wallet
  const { ready, authenticated, user } = usePrivy();

  const [appState, setAppState] = useState<AppState>("IDLE");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Get embedded wallet from Privy user
  const embeddedWallet = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
  );
  const serverWalletAddress = embeddedWallet?.address || null;
  const privyUserId = user?.id || null;

  // AES encryption key (must match server)
  const AES_KEY = 'econwall-secure-key-for-urls!!'.padEnd(32, '0').slice(0, 32);

  // Convert string to ArrayBuffer
  const str2ab = (str: string): ArrayBuffer => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  // Convert ArrayBuffer to hex string
  const ab2hex = (buffer: ArrayBuffer): string => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // AES-256-CBC encrypt using Web Crypto API
  const encryptUrl = async (url: string): Promise<string> => {
    const keyData = str2ab(AES_KEY);
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']
    );

    // Generate random 16-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Encrypt
    const encoded = new TextEncoder().encode(url);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      encoded
    );

    // Return: iv (hex) + ciphertext (hex)
    return ab2hex(iv.buffer) + ab2hex(encrypted);
  };

  // Log embedded wallet status
  useEffect(() => {
    if (authenticated && embeddedWallet) {
      console.log("✅ [Page] Embedded Wallet Ready:", embeddedWallet.address);
      console.log("✅ [Page] Delegated:", embeddedWallet.delegated);
    }
  }, [authenticated, embeddedWallet]);

  // Check EWT token access
  const handleCheckAccess = async () => {
    if (!serverWalletAddress) return;

    setAppState("CHECKING");
    setError(null);

    // 1. Try "The Real Way" (CCIP-Read) first
    try {
      console.log("Attempting On-Chain CCIP-Read...");
      await resolveEnsWithCcip(RESOLVER_ADDRESS as Hex, "econwall.eth", serverWalletAddress as Hex);
      setAppState("BROWSER");
      return;
    } catch (err) {
      console.warn("CCIP-Read failed (falling back to API shortcut):", err);
    }

    // 2. Fallback: "The Hackathon Way" (API Shortcut)
    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: serverWalletAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAppState("DENIED");
        setError(data.error || "Access denied - No EWT tokens");
        return;
      }

      // Access granted - show browser
      setAppState("BROWSER");
    } catch (err: any) {
      console.error("Access check error:", err);
      setAppState("DENIED");
      setError(err.message || "Network error");
    }
  };

  // Navigate to proxy
  const handleBrowse = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let targetUrl = url;
    if (!targetUrl.startsWith("http")) {
      targetUrl = "https://" + targetUrl;
    }

    const encrypted = await encryptUrl(targetUrl);
    window.location.href = `/api/proxy?u=${encrypted}`;
  };

  // Quick links
  const quickLinks = [
    { name: "Wikipedia", url: "wikipedia.org" },
    { name: "GitHub", url: "github.com" },
    { name: "DuckDuckGo", url: "duckduckgo.com" },
    { name: "Hacker News", url: "news.ycombinator.com" },
  ];

  // Hydration Fix
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null; // Avoid server/client mismatch

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-6 flex items-center justify-between animate-slide-in-down relative z-10">
        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold tracking-tight text-foreground">
            ECONWALL
          </div>
          <div className="text-muted-foreground text-sm">
            {appState === "BROWSER" ? "BROWSER" : "PORTAL"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {appState === "BROWSER" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Session:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-foreground font-medium font-mono">
                  {serverWalletAddress?.slice(0, 6)}...
                </span>
              </span>
            </div>
          )}

          <Link
            href="/swap"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            Token Swap
          </Link>

          {authenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
              className="gap-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 group shadow-lg shadow-purple-500/10 transition-all hover:shadow-purple-500/20"
            >
              <Wallet className="w-4 h-4 transition-transform group-hover:scale-110" />
              Wallet
            </Button>
          )}

          <ConnectWallet />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">

        {/* NOT CONNECTED */}
        {!authenticated && (
          <Card className="w-full max-w-sm animate-scale-in">
            <CardContent className="flex flex-col items-center gap-6 py-12 px-8">
              <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Portal Locked</h2>
                <p className="text-sm text-muted-foreground">
                  Connect your wallet to continue
                </p>
              </div>
              <ConnectWallet />
            </CardContent>
          </Card>
        )}

        {/* CONNECTED - IDLE: Show access check */}
        {authenticated && appState === "IDLE" && (
          <Card className="w-full max-w-md animate-scale-in">
            <CardHeader>
              <CardTitle className="text-xl">Token-Gated Browser</CardTitle>
              <CardDescription>
                Access the secure proxy with EWT tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Embedded Wallet</div>
                <div className="text-sm font-mono truncate">{serverWalletAddress || 'Creating...'}</div>
              </div>
              <button
                onClick={handleCheckAccess}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-all duration-300 shadow-sm hover:shadow-lg"
              >
                Check Access
              </button>
              <div className="text-xs text-muted-foreground text-center">
                Requires EWT tokens on Arc Testnet
              </div>
            </CardContent>
          </Card>
        )}

        {/* CHECKING */}
        {authenticated && appState === "CHECKING" && (
          <Card className="w-full max-w-md animate-scale-in">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <div className="font-medium">Checking Access...</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Verifying EWT balance on Arc Testnet
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DENIED */}
        {authenticated && appState === "DENIED" && (
          <Card className="w-full max-w-md animate-scale-in border-red-500/50">
            <CardHeader>
              <CardTitle className="text-xl text-red-500 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
                Access Denied
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-muted-foreground">
                You need EWT tokens on Arc Testnet to access the browser.
              </div>
              <div className="flex gap-3">

                <Link
                  href="/swap"
                  className="flex-1 h-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90"
                >
                  Get EWT Tokens
                </Link>
                <button
                  onClick={() => setAppState("IDLE")}
                  className="h-10 px-4 rounded-xl bg-muted text-foreground font-medium text-sm border border-border hover:bg-muted/80"
                >
                  Retry
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BROWSER MODE */}
        {authenticated && appState === "BROWSER" && (
          <Card className="w-full max-w-2xl animate-scale-in">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Token-Gated Browser
              </CardTitle>
              <CardDescription>
                ✓ Access granted • Enter any URL to browse securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBrowse} className="flex flex-col gap-4">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL (e.g., wikipedia.org)"
                  className="w-full h-14 px-6 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground text-base font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-300"
                  autoFocus
                />
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm hover:shadow-lg"
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppState("IDLE")}
                    className="h-12 px-4 rounded-xl bg-muted text-foreground font-medium text-sm border border-border hover:bg-muted/80"
                  >
                    Exit
                  </button>
                </div>
              </form>

              {/* Quick Links */}
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Quick Links</p>
                <div className="flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <button
                      key={link.url}
                      onClick={async () => {
                        const fullUrl = `https://${link.url}`;
                        const encrypted = await encryptUrl(fullUrl);
                        window.location.href = `/api/proxy?u=${encrypted}`;
                      }}
                      className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-all duration-300 border border-border"
                    >
                      {link.name}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Sidebar Component */}
      {authenticated && (
        <ServerWalletSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          walletAddress={serverWalletAddress || ''}
          privyUserId={privyUserId}
        />
      )}

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center animate-fade-in">
        <p className="text-muted-foreground text-xs font-mono">
          ECONWALL • Token-Gated Browser • ENS + CCIP-Read + Arc Testnet
        </p>
      </footer>
    </div >
  );
}
