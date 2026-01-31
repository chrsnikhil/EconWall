"use client";

import { useState, FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

type PortalStatus = "IDLE" | "LOADING" | "BLOCKED" | "SUCCESS";

export default function Home() {
  const [query, setQuery] = useState("");
  const [portalStatus, setPortalStatus] = useState<PortalStatus>("IDLE");
  const [targetUrl, setTargetUrl] = useState("");
  const [price, setPrice] = useState("0");

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setPortalStatus("LOADING");

    // --- LOGIC BRANCH 1: Is it a protected ENS domain? ---
    if (query.toLowerCase().endsWith(".eth")) {
      try {
        const res = await fetch(`/api/resolve?q=${query}`);
        const data = await res.json();

        if (data.status === "BLOCKED") {
          setPrice(data.price);
          setPortalStatus("BLOCKED");
        } else if (data.status === "OPEN") {
          setTargetUrl(data.url);
          setPortalStatus("SUCCESS");
          setTimeout(() => {
            window.location.href = data.url;
          }, 1500);
        }
      } catch (err) {
        console.error("Gateway Error", err);
        setPortalStatus("IDLE");
      }
    }
    // --- LOGIC BRANCH 2: Is it a normal URL? (google.com) ---
    else if (query.includes(".") && !query.includes(" ")) {
      const url = query.startsWith("http") ? query : `https://${query}`;
      setTargetUrl(url);
      setPortalStatus("SUCCESS");
      setTimeout(() => {
        window.location.href = url;
      }, 800);
    }
    // --- LOGIC BRANCH 3: Is it just random words? ---
    else {
      window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, "_blank");
      setPortalStatus("IDLE");
    }
  };

  const deployAgentAndPay = () => {
    // TODO: Integrate LI.FI widget here
    alert("LI.FI Agent deployment coming soon!");
  };

  const resetPortal = () => {
    setPortalStatus("IDLE");
    setQuery("");
    setPrice("0");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-6 flex items-center justify-between animate-slide-in-down relative z-10">
        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold tracking-tight text-foreground">
            ECONWALL
          </div>
          <div className="text-muted-foreground text-sm">PORTAL</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${portalStatus === "BLOCKED"
                    ? "bg-red-500"
                    : portalStatus === "LOADING"
                      ? "bg-yellow-500 animate-pulse"
                      : portalStatus === "SUCCESS"
                        ? "bg-green-500"
                        : "bg-green-500"
                  }`}
              ></span>
              <span className="text-foreground font-medium">
                {portalStatus === "BLOCKED"
                  ? "Blocked"
                  : portalStatus === "LOADING"
                    ? "Resolving..."
                    : portalStatus === "SUCCESS"
                      ? "Access Granted"
                      : "Online"}
              </span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        {/* SCENARIO A: Normal Search (IDLE) */}
        {(portalStatus === "IDLE" || portalStatus === "LOADING") && (
          <Card className="w-full max-w-2xl animate-scale-in">
            <CardHeader>
              <CardTitle className="text-2xl">Portal Search</CardTitle>
              <CardDescription>
                Enter a search query, URL, or ENS domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex flex-col gap-4">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search, URL, or .eth domain..."
                    disabled={portalStatus === "LOADING"}
                    className="w-full h-14 px-6 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground text-base font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-300 disabled:opacity-50"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={portalStatus === "LOADING" || !query.trim()}
                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm hover:shadow-lg"
                  >
                    {portalStatus === "LOADING" ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Resolving...</span>
                      </span>
                    ) : (
                      "Search"
                    )}
                  </button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Press</span>
                    <kbd className="px-2 py-1 rounded-xl bg-muted text-foreground font-mono text-xs border border-border">
                      Enter
                    </kbd>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* SCENARIO B: The Firewall (BLOCKED) */}
        {portalStatus === "BLOCKED" && (
          <Card className="w-full max-w-2xl animate-scale-in border-red-500/50">
            <CardHeader>
              <CardTitle className="text-2xl text-red-500 flex items-center gap-3">
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
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                ACCESS DENIED
              </CardTitle>
              <CardDescription>
                Surge protection active for <strong>{query}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Congestion Info */}
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Price:</span>
                  <span className="text-2xl font-bold text-red-500">
                    ${price}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  High traffic detected. Pay to bypass the queue.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={deployAgentAndPay}
                  className="flex-1 h-12 px-6 rounded-xl bg-red-500 text-white font-semibold text-sm uppercase tracking-wider hover:bg-red-600 transition-all duration-300 shadow-sm hover:shadow-lg"
                >
                  Deploy Agent & Pay
                </button>
                <button
                  onClick={resetPortal}
                  className="h-12 px-6 rounded-xl bg-muted text-foreground font-semibold text-sm uppercase tracking-wider hover:bg-muted/80 transition-all duration-300 border border-border"
                >
                  Go Back
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SCENARIO C: Success */}
        {portalStatus === "SUCCESS" && (
          <Card className="w-full max-w-2xl animate-scale-in border-green-500/50">
            <CardHeader>
              <CardTitle className="text-2xl text-green-500 flex items-center gap-3">
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
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                ACCESS GRANTED
              </CardTitle>
              <CardDescription>
                Redirecting to secure server...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-muted-foreground">
                  Destination: <strong className="text-foreground">{targetUrl}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center animate-fade-in">
        <p className="text-muted-foreground text-xs font-mono">
          ECONWALL PORTAL v1.0 • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
