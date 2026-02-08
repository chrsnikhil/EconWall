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
import { Wallet, X } from "lucide-react";

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
  const [registeredSites, setRegisteredSites] = useState<any[]>([]);
  const [showFaq, setShowFaq] = useState(false);

  // Fetch registered sites
  useEffect(() => {
    fetch("/api/register")
      .then(res => res.json())
      .then(data => {
        setRegisteredSites(Object.values(data));
      })
      .catch(err => console.error("Failed to fetch sites:", err));
  }, []);

  // Get embedded wallet from Privy user
  const embeddedWallet = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
  );
  const serverWalletAddress = (embeddedWallet as any)?.address || null;
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
      console.log("✅ [Agent: Interface] Embedded Wallet Ready:", (embeddedWallet as any).address);
      console.log("✅ [Agent: Interface] Delegated:", (embeddedWallet as any).delegated);
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
      await resolveEnsWithCcip(RESOLVER_ADDRESS as Hex, "econwall.eth", serverWalletAddress as Hex, privyUserId);
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
        body: JSON.stringify({ sender: serverWalletAddress, privyUserId }),
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

    // RESOLVE ENS NAMES
    if (targetUrl.toLowerCase().includes('.eth')) {
      try {
        // Show some loading state if possible, or just await
        const res = await fetch("/api/gateway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: targetUrl,
            sender: serverWalletAddress,
            privyUserId
          }),
        });
        const data = await res.json();

        if (res.ok && data.proxyUrl) {
          console.log(`[Browser] Resolved ${targetUrl} -> ${data.proxyUrl}`);
          targetUrl = data.proxyUrl;
        } else {
          setError(`Could not resolve ${targetUrl}`);
          setAppState("DENIED"); // Show error state
          return;
        }
      } catch (err) {
        console.error("Resolution failed:", err);
        return;
      }
    } else if (!targetUrl.startsWith("http")) {
      targetUrl = "https://" + targetUrl;
    }

    const encrypted = await encryptUrl(targetUrl);
    window.location.href = `/api/proxy?u=${encrypted}`;
  };

  // Heartbeat: Check access every 3 minutes when in BROWSER mode
  useEffect(() => {
    if (appState !== "BROWSER" || !serverWalletAddress) return;

    const interval = setInterval(() => {
      console.log("💓 [Agent: Interface] 3-Minute Heartbeat - Verifying Session...");
      handleCheckAccess();
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(interval);
  }, [appState, serverWalletAddress]);

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
            href="/register"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-4"
          >
            Register Site
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
          <button
            onClick={() => setShowFaq(true)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            FAQ
          </button>
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
                <p className="text-sm text-muted-foreground mb-4">
                  Complete setup to continue
                </p>

                <div className="text-left bg-muted/50 p-4 rounded-lg border border-border/50 text-sm space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border text-[10px] font-mono font-bold">1</span>
                    <span>Connect MetaMask</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border text-[10px] font-mono font-bold">2</span>
                    <span>Create Embedded Wallet</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-background border border-border text-[10px] font-mono font-bold">3</span>
                    <span>Grant Server Access</span>
                  </div>
                </div>
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
                Requires EWT tokens on Unichain Sepolia
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
                    Verifying EWT balance on Unichain Sepolia
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
                You need EWT tokens on Unichain Sepolia to access the browser.
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

              {/* Registered Sites */}
              {registeredSites.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Community Sites
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {registeredSites.map((site) => (
                      <button
                        key={site.ensName}
                        onClick={async () => {
                          const encrypted = await encryptUrl(site.actualUrl);
                          window.location.href = `/api/proxy?u=${encrypted}`;
                        }}
                        className="px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-muted/50 transition-all duration-300 text-left group"
                      >
                        <div className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                          {site.subdomain}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                          {site.ensName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* FAQ Modal */}
      {showFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setShowFaq(false)}>
          <div
            className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative font-mono"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 right-0 p-4 flex justify-end bg-background/90 backdrop-blur-sm z-10 border-b border-border/40">
              <button
                onClick={() => setShowFaq(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Close FAQ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pb-10 space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Frequently Asked Questions</h2>
                <p className="text-muted-foreground text-sm">How EconWall works under the hood.</p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
                  <h3 className="text-base font-semibold text-foreground mb-3 flex items-start gap-2">
                    <span className="text-primary mt-0.5">01.</span>
                    "Don't normal people have to pay ETH to browse?"
                  </h3>
                  <div className="text-muted-foreground text-sm leading-relaxed space-y-3 pl-7">
                    <p><strong className="text-foreground">No.</strong> Website owners fund embedded wallets with small amounts of ETH. Users browse for free.</p>
                    <p><strong>The math:</strong> A normal browsing session (20 clicks) costs ~5-6 cents in swaps. Website owners pay for this—it's 10x-100x cheaper than their Cloudflare bill ($5k-$50k/month).</p>
                    <p>For users who don't have an embedded wallet, the cost is negligible: they pay a few cents per session. Most websites fund the wallets anyway because it's cheaper than DDoS protection.</p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
                  <h3 className="text-base font-semibold text-foreground mb-3 flex items-start gap-2">
                    <span className="text-primary mt-0.5">02.</span>
                    "Can botnets with 1000 wallets just bypass surge pricing?"
                  </h3>
                  <div className="text-muted-foreground text-sm leading-relaxed space-y-3 pl-7">
                    <p><strong className="text-foreground">No.</strong> Three layers stop them:</p>
                    <ul className="list-disc pl-4 space-y-2 marker:text-muted-foreground/50">
                      <li><strong>First:</strong> Rolling encrypted URLs—each request gets a unique AES-encrypted path. Even with 1000 wallets, they can't guess the paths. They're hitting a moving target.</li>
                      <li><strong>Second:</strong> Wallet creation rate-limiting—creating 1000 wallets triggers our detection. Takes hours to farm them, and by then we've blocked the pattern.</li>
                      <li><strong>Third:</strong> Surge pricing escalates fast. By the 4th swap, fees multiply (3x, 6x, 10x). Sustaining a distributed attack across 1000 wallets costs $30k+/minute cost. Their ETH runs out. Botnets are free—they're not.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
                  <h3 className="text-base font-semibold text-foreground mb-3 flex items-start gap-2">
                    <span className="text-primary mt-0.5">03.</span>
                    "Can't they just DDoS the Gateway?"
                  </h3>
                  <div className="text-muted-foreground text-sm leading-relaxed space-y-3 pl-7">
                    <p><strong className="text-foreground">No.</strong> The Gateway itself is hidden behind an ENS domain.</p>
                    <p>When the browser needs to contact the Gateway, it doesn't connect to a public IP. It resolves <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">gateway.econwall.eth</code>—which also uses CCIP-Read to hide the real location.</p>
                    <p>You can't DDoS what you can't find. The Gateway's IP is cryptographically hidden, just like the origin server. If attackers somehow find one Gateway node, it's stateless and distributed—they can spin up more nodes instantly.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center animate-fade-in">
        <p className="text-muted-foreground text-xs font-mono">
          ECONWALL • Token-Gated Browser • ENS + CCIP-Read + Unichain Sepolia
        </p>
      </footer>
    </div >
  );
}
