"use client";

import { useState } from "react";
import { Check, Copy, AlertCircle, ArrowRight, Loader2, Globe, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RegistrationResponse {
    success: boolean;
    data?: {
        subdomain: string;
        ensName: string;
        actualUrl: string;
    };
    error?: string;
}

export function SiteRegistration() {
    const [subdomain, setSubdomain] = useState("");
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RegistrationResponse | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subdomain, actualUrl: url }),
            });
            const data = await res.json();

            // Add a small delay for visual feedback
            await new Promise(resolve => setTimeout(resolve, 800));

            setResult(data);
        } catch (err) {
            setResult({ success: false, error: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-xl mx-auto border-border bg-card text-card-foreground shadow-lg animate-scale-in">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    <div className="p-1 rounded bg-foreground text-background animate-scale-in delay-200">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    Register Protected Site
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                    Create an ENS subdomain that resolves secure content.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {result?.success && result.data ? (
                    /* SUCCESS STATE */
                    <div className="space-y-6 animate-slide-in-up">
                        <div className="p-6 bg-muted/30 border border-border rounded-xl flex flex-col items-center text-center gap-4 animate-scale-in delay-100">
                            <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center">
                                <Check className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Registration Complete</h3>
                                <p className="text-muted-foreground mt-1">Your site is now resolvable on EconWall.</p>
                            </div>
                        </div>

                        <div className="space-y-2 animate-slide-in-up delay-200">
                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest pl-1">Your ENS Name</label>
                            <div className="flex items-center gap-2 group/copy">
                                <code className="flex-1 p-4 bg-muted/50 border border-border rounded-xl font-mono text-foreground text-lg shadow-sm flex items-center justify-between group-hover/copy:border-foreground/20 transition-colors">
                                    {result.data.ensName}
                                    <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-14 w-14 rounded-xl border-border bg-background hover:bg-muted text-foreground transition-all"
                                    onClick={() => navigator.clipboard.writeText(result.data?.ensName || "")}
                                >
                                    <Copy className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-border animate-slide-in-up delay-300">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-widest">Next Steps</h4>
                            <ul className="space-y-4 text-sm text-muted-foreground">
                                <li className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-muted text-foreground flex items-center justify-center text-xs font-mono border border-border">1</span>
                                    <span className="pt-0.5">Add middleware to your server.</span>
                                </li>
                                <li className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-muted text-foreground flex items-center justify-center text-xs font-mono border border-border">2</span>
                                    <span className="pt-0.5">Try accessing directly (check blocking).</span>
                                </li>
                                <li className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-muted text-foreground flex items-center justify-center text-xs font-mono border border-border">3</span>
                                    <span className="pt-0.5">Visit <b className="text-foreground">{result.data.ensName}</b> in the browser.</span>
                                </li>
                            </ul>
                        </div>

                        <Button
                            className="w-full h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium transition-all border border-border"
                            variant="secondary"
                            onClick={() => { setResult(null); setSubdomain(""); setUrl(""); }}
                        >
                            Register Another Site
                        </Button>
                    </div>
                ) : (
                    /* FORM STATE */
                    <form onSubmit={handleSubmit} className="space-y-6 animate-slide-in-right">
                        <div className="space-y-2 group/field">
                            <label className="text-sm font-medium text-muted-foreground group-focus-within/field:text-foreground transition-colors">Subdomain</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    pattern="[a-z0-9]{1,20}"
                                    placeholder="mysite"
                                    className="w-full h-14 pl-4 pr-32 bg-input border border-border rounded-xl focus:ring-1 focus:ring-foreground focus:border-foreground outline-none transition-all placeholder:text-muted-foreground/50 font-mono text-foreground shadow-sm hover:shadow-md"
                                    value={subdomain}
                                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                                />
                                <div className="absolute right-4 top-[18px] text-muted-foreground font-mono select-none pointer-events-none bg-muted px-2 rounded text-sm group-focus-within/field:text-foreground transition-colors">
                                    .econwall.eth
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground pl-1">Lowercase letters & numbers only.</p>
                        </div>

                        <div className="space-y-2 group/field">
                            <label className="text-sm font-medium text-muted-foreground group-focus-within/field:text-foreground transition-colors">Destination URL</label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-[18px] w-5 h-5 text-muted-foreground group-focus-within/field:text-foreground transition-colors" />
                                <input
                                    type="url"
                                    required
                                    placeholder="https://mysite.com"
                                    className="w-full h-14 pl-12 bg-input border border-border rounded-xl focus:ring-1 focus:ring-foreground focus:border-foreground outline-none transition-all placeholder:text-muted-foreground/50 text-foreground shadow-sm hover:shadow-md"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground pl-1">The actual location of your content (hidden).</p>
                        </div>

                        {result?.error && (
                            <div className="animate-slide-in-down">
                                <div className="p-4 bg-muted border border-foreground/10 rounded-xl flex items-center gap-3 text-sm text-foreground">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    {result.error}
                                </div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-14 bg-foreground hover:bg-foreground/90 text-background font-bold text-lg rounded-xl shadow-md hover:shadow-xl transition-all"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    Register Site <ArrowRight className="w-5 h-5" />
                                </span>
                            )}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
