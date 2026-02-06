"use client";

import Link from "next/link";
import { SiteRegistration } from "@/components/site-registration";

export default function RegisterPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono selection:bg-foreground selection:text-background overflow-x-hidden">
            {/* Header */}
            <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-70 transition-opacity flex items-center gap-2">
                        <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center text-background text-xs font-bold">E</div>
                        ECONWALL
                    </Link>
                    <nav className="flex items-center gap-6 text-sm font-medium">
                        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors relative group">
                            Browser
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-foreground group-hover:w-full transition-all duration-300" />
                        </Link>
                        <Link href="/register" className="text-foreground relative">
                            Register
                            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-foreground" />
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Left Column: Form */}
                    <div className="space-y-12">
                        <div className="mb-8 animate-slide-in-down">
                            <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
                                Protect Your <br />
                                <span className="bg-foreground text-background px-2">Digital Assets.</span>
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                                Register your site with EconWall to hide your real URL and prevent DDoS attacks. Only verified traffic gets through.
                            </p>
                        </div>

                        <div className="animate-scale-in delay-100">
                            <SiteRegistration />
                        </div>

                        <div className="mt-12 p-1 rounded-xl bg-border border border-border animate-slide-in-up delay-200">
                            <div className="bg-card rounded-lg p-6 shadow-sm">
                                <h3 className="font-semibold mb-4 flex items-center gap-3">
                                    <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs uppercase tracking-wide border border-border">Dev Guide</span>
                                    <span>Server Integration</span>
                                </h3>
                                <div className="prose prose-invert prose-sm">
                                    <p className="text-muted-foreground mb-3">Add this middleware check to block unauthorized traffic:</p>
                                    <div className="relative group">
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                        </div>
                                        <pre className="bg-muted p-4 pt-8 rounded-lg overflow-x-auto border border-border group-hover:border-foreground/20 transition-colors">
                                            <code className="text-xs font-mono text-muted-foreground">
                                                {`// middleware.ts
export function middleware(req) {
  const ua = req.headers.get('user-agent');
  if (!ua?.includes('EconWall')) {
    return new Response('Access Denied', { status: 403 });
  }
}`}
                                            </code>
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: FAQ & Steps */}
                    <div className="space-y-16 lg:pt-12 animate-fade-in delay-300">
                        {/* Steps */}
                        <div className="space-y-8">
                            <h2 className="text-2xl font-bold flex items-center gap-2 animate-slide-in-right delay-200">
                                <span className="w-1 h-8 bg-foreground rounded-full" />
                                How It Works
                            </h2>

                            <div className="relative border-l border-border ml-3 space-y-12 pb-4">
                                {[
                                    { title: "Register Name", desc: "Claim a unique .econwall.eth subdomain." },
                                    { title: "Configure Routing", desc: "We map your ENS name to your actual server URL mapping." },
                                    { title: "Enable Protection", desc: "Add the User-Agent check middleware to your server." },
                                    { title: "Instant Access", desc: "Users browse securely via EconWall Browser." }
                                ].map((step, i) => (
                                    <div
                                        key={i}
                                        className={`ml-10 relative group animate-slide-in-right`}
                                        style={{ animationDelay: `${(i * 100) + 300}ms` }}
                                    >
                                        <span className="absolute -left-[49px] top-1 w-8 h-8 rounded-full bg-background border border-border group-hover:border-foreground transition-colors flex items-center justify-center text-sm font-mono z-10 text-muted-foreground group-hover:text-foreground">
                                            {i + 1}
                                        </span>
                                        <h3 className="font-semibold text-lg mb-1 group-hover:text-foreground transition-colors">{step.title}</h3>
                                        <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FAQ */}
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2 animate-slide-in-right delay-500">
                                <span className="w-1 h-8 bg-muted-foreground rounded-full" />
                                FAQ
                            </h2>

                            <div className="space-y-4">
                                {[
                                    { q: "Is this a real ENS domain?", a: "Yes, it is a real ENS domain that uses a text record to resolve to your underlying URL." },
                                    { q: "Can I change my URL later?", a: "Yes, currently you can update it by re-registering the same subdomain." },
                                    { q: "Does this stop all bots?", a: "The middleware blocks unauthorized traffic. For enterprise-grade security, configure your firewall to allowlist the EconWall Agent IP addresses." },
                                    { q: "How much does it cost?", a: "Registration is free for the hackathon. Browsing costs users EWT tokens." }
                                ].map((faq, i) => (
                                    <details
                                        key={i}
                                        className={`group bg-card border border-border rounded-xl overflow-hidden open:shadow-md transition-all duration-300 animate-slide-in-up`}
                                        style={{ animationDelay: `${(i * 100) + 600}ms` }}
                                    >
                                        <summary className="flex items-center justify-between p-4 cursor-pointer font-medium hover:text-foreground transition-colors select-none text-muted-foreground">
                                            {faq.q}
                                            <span className="opacity-50 group-open:rotate-180 transition-transform duration-300">▼</span>
                                        </summary>
                                        <div className="px-4 pb-4 text-muted-foreground text-sm leading-relaxed animate-fade-in border-t border-border/50 pt-4">
                                            {faq.a}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="border-t border-border mt-20 py-8 text-center text-muted-foreground text-sm bg-background relative z-10">
                <p className="flex items-center justify-center gap-2">
                    © 2026 EconWall <span className="w-1 h-1 rounded-full bg-muted-foreground" /> Built for the Hackathon
                </p>
            </footer>
        </div>
    );
}
