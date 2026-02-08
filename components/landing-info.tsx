import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck, Zap, Globe, Lock, Wallet, Server, Activity, ChevronRight } from "lucide-react";

export function LandingInfo() {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-24 space-y-32 font-mono">

            {/* Section 1: Problem vs Solution */}
            <section className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <span>Architecture v1.0</span>
                        <span className="w-1 h-1 rounded-full bg-foreground/20"></span>
                        <span>Unichain Sepolia</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight">The Web3-Native Cloudflare</h2>
                    <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        EconWall replaces fragile, centralized IP blocking with an unstoppable On-Chain Economic Firewall.
                        Attackers have infinite IPs, but finite capital.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* The Problem */}
                    <Card className="bg-muted/30 border-muted-foreground/10 hover:border-muted-foreground/20 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legacy Infrastructure</div>
                            </div>
                            <CardTitle className="text-xl">Web2 Fragility</CardTitle>
                            <CardDescription className="text-sm">
                                Centralized gatekeepers are fundamentally flawed at scale.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground">01.</span> Censorship Risk
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-border ml-1">
                                        Centralized entities can de-platform sites arbitrarily based on jurisdiction or politics. access is permissioned, not guaranteed.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground">02.</span> Uneconomical Security
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-border ml-1">
                                        Enterprise DDoS protection costs $5k-$50k/month. This pricing model prices out small dApps and personal privacy tools.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground">03.</span> The IP Whac-A-Mole
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-border ml-1">
                                        IP blocking is temporary. Attackers rotate IPs infinitely using botnets. Static blocklists cannot stop dynamic threats.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* The Solution */}
                    <Card className="bg-card border-border hover:border-foreground/20 transition-all duration-300 shadow-lg shadow-black/5">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div className="text-xs font-semibold uppercase tracking-widest text-foreground">EconWall Protocol</div>
                            </div>
                            <CardTitle className="text-xl">Economic Friction</CardTitle>
                            <CardDescription className="text-sm">
                                Mathematically proving that attack cost {'>'} value extraction.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-primary">01.</span> Uniswap V4 Hooks
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-primary/50 ml-1">
                                        Surge pricing logic lives on-chain. During an attack, fees typically multiply 10x-100x. An attack that once cost $10 now costs $10,000.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-primary">02.</span> Cryptographic Privacy
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-primary/50 ml-1">
                                        We don't track IPs. We verify cryptographic signatures. Access is granted based on <em>access rights</em> (tokens), not location.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <span className="text-primary">03.</span> Agentic Micropayments
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed pl-6 border-l border-primary/50 ml-1">
                                        Legitimate users pay pennies via automated micro-swaps. The "Agent Wallet" handles the complexity; users just browse.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 2: Architecture Features */}
            <section className="space-y-16">
                <div className="text-center space-y-6">
                    <h2 className="text-3xl font-bold tracking-tight">System Architecture</h2>
                    <p className="text-base text-muted-foreground">
                        Leveraging next-gen primitives on Unichain Sepolia.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="hover:bg-muted/50 transition-colors border-border/50">
                        <CardHeader>
                            <Zap className="w-8 h-8 text-foreground mb-4" />
                            <CardTitle className="text-lg">Uniswap V4 Hooks</CardTitle>
                        </CardHeader>
                        <CardContent className="text-muted-foreground text-sm leading-7">
                            <p>
                                Our custom Hook <code>SurgeHook.sol</code> intercepts every swap. It maintains a rolling window of volume.
                            </p>
                            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs font-mono border border-border whitespace-pre overflow-x-auto">
                                {`// From SurgeHook.sol
function _getGlobalFee(PoolId poolId) internal view returns (uint24) {
    uint256 swaps = _countGlobalSwaps(poolId);
    
    if (swaps >= 150) return 250000; // 25.00%
    if (swaps >= 100) return 150000; // 15.00%
    if (swaps >= 60)  return 50000;  // 5.00%
    return 100;                      // 0.01%
}`}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="hover:bg-muted/50 transition-colors border-border/50">
                        <CardHeader>
                            <Globe className="w-8 h-8 text-foreground mb-4" />
                            <CardTitle className="text-lg">ENS + CCIP-Read</CardTitle>
                        </CardHeader>
                        <CardContent className="text-muted-foreground text-sm leading-7">
                            <p>
                                Acts as a "Decentralized DNS". Users query <code>gateway.econwall.eth</code>. The resolution logic is off-chain (CCIP-Read), allowing us to return dynamic, signed data without gas costs for the user.
                            </p>
                            <ul className="mt-4 space-y-2 text-xs">
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-foreground rounded-full"></div>EIP-3668 Standard</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-foreground rounded-full"></div>OffchainLookup Revert</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="hover:bg-muted/50 transition-colors border-border/50">
                        <CardHeader>
                            <Lock className="w-8 h-8 text-foreground mb-4" />
                            <CardTitle className="text-lg">AES-256 Encryption</CardTitle>
                        </CardHeader>
                        <CardContent className="text-muted-foreground text-sm leading-7">
                            <p>
                                The "Real Web" is hidden. The proxy creates a secure tunnel.
                            </p>
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border border-border">
                                    <span>Client</span>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    <span>Encrypted req</span>
                                </div>
                                <div className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded border border-border">
                                    <span>Proxy</span>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    <span>Decrypt & Fetch</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 3: Feature Grid - Monotone */}
            <section className="space-y-12 pb-12 border-t border-border pt-12">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-foreground/50 transition-colors space-y-4">
                        <Server className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Token-Gated</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Access strictly requires EWT tokens held in a Unichain wallet. No tokens, no connection.</p>
                    </div>
                    <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-foreground/50 transition-colors space-y-4">
                        <Wallet className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Agentic Wallet</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Background agent monitors session status and auto-signs micro-transactions.</p>
                    </div>
                    <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-foreground/50 transition-colors space-y-4">
                        <Activity className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Live Metrics</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Real-time session telemetry. Track your bandwidth cost down to the wei.</p>
                    </div>
                    <div className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-foreground/50 transition-colors space-y-4">
                        <ShieldCheck className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Unstoppable</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Core logic lives on immutable smart contracts. Resistant to centralized takedowns.</p>
                    </div>
                </div>
            </section>

        </div>
    );
}
