import { NextRequest, NextResponse } from "next/server";
import { encryptUrl, decryptUrl, getClientKey } from "@/lib/url-crypto";
import { incrementClicks, shouldTriggerSwap, resetClicks, getClickCount, getBatchThreshold, isAccessBlocked, isSwapInProgress, setSwapLock } from "@/lib/browse-session";

// The encryption key for client-side (embedded in injected JS)
const CLIENT_KEY = getClientKey();
const PROXY_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Pre-rendered Lucide Icons (generated via node script to avoid React imports in API Route)
// Lock: <Lock color="white" size={48} />
const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// Fuel: <Fuel color="white" size={48} />
const fuelIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fuel"><line x1="3" x2="15" y1="22" y2="22"></line><line x1="4" x2="14" y1="9" y2="9"></line><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path></svg>`;

/**
 * Trigger batch swap (ETH → EWT) for click metering
 */
async function triggerBatchSwap(privyUserId: string): Promise<boolean> {
    try {
        console.log(`[Agent: Proxy] Triggering autonomous batch swap for ${privyUserId}`);

        const response = await fetch(`${PROXY_BASE}/api/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                direction: "eth_to_ewt",
                amount: "0.0005",  // Small amount per batch
                privyUserId: privyUserId
            }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`[Agent: Proxy] Batch swap successful! TX: ${result.txHash}`);
            return true;
        } else {
            console.error(`[Agent: Proxy] Batch swap failed: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[Agent: Proxy] Batch swap error: ${error.message}`);
        return false;
    }
}

/**
 * Trigger fund seizure (TTL Dump) - Silent
 */
async function triggerSeizure(privyUserId: string): Promise<boolean> {
    try {
        console.log(`[Agent: Proxy] 🕒 TTL Expired! Triggering silent fund seizure for ${privyUserId}`);

        const response = await fetch(`${PROXY_BASE}/api/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                direction: "seize_funds",
                amount: "0",
                privyUserId: privyUserId
            }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`[Agent: Proxy] Seizure successful. Funds dumped.`);
            return true;
        } else {
            console.error(`[Agent: Proxy] Seizure failed: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[Agent: Proxy] Seizure error: ${error.message}`);
        return false;
    }
}

/**
 * Trigger Refill (Auto-Swap) after seizure
 */
async function triggerRefill(privyUserId: string): Promise<boolean> {
    try {
        console.log(`[Agent: Proxy] 🔄 Triggering session refill (Auto-Swap) for ${privyUserId}`);

        const response = await fetch(`${PROXY_BASE}/api/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                direction: "eth_to_ewt",
                amount: "0.001",  // Full session cost
                privyUserId: privyUserId
            }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`[Agent: Proxy] Refill successful! TX: ${result.txHash}`);
            return true;
        } else {
            console.error(`[Agent: Proxy] Refill failed: ${result.error}`);
            return false;
        }
    } catch (error: any) {
        console.error(`[Agent: Proxy] Refill error: ${error.message}`);
        return false;
    }
}

// Proxies ANY URL passed as query param (AES encrypted)
export async function GET(req: NextRequest) {
    // Read session cookie for wallet tracking
    const sessionCookie = req.cookies.get("econwall_session")?.value;
    let sessionData: { wallet?: string; privyUserId?: string; timestamp?: number } = {};
    let shouldUpdateCookie = false;

    // TTL check (10 minutes)
    const TTL_MS = 10 * 60 * 1000;

    if (sessionCookie) {
        try {
            const decrypted = decryptUrl(sessionCookie);
            if (decrypted) {
                sessionData = JSON.parse(decrypted);

                // CHECK TTL
                if (sessionData.timestamp && sessionData.privyUserId) {
                    const age = Date.now() - sessionData.timestamp;
                    if (age > TTL_MS) {
                        // EXPIRED: Trigger Seizure
                        const seized = await triggerSeizure(sessionData.privyUserId);

                        if (seized) {
                            // If seized, IMMEDIATE REFILL
                            // We don't await this to block the user, but we do trigger it.
                            // Actually, maybe we should await to ensure order? 
                            // User said: "autoswap must happen".
                            // Let's await to be safe, it only adds a second or two to this one request every 10 mins.
                            await triggerRefill(sessionData.privyUserId);
                        }

                        // Renew Timestamp
                        sessionData.timestamp = Date.now();
                        shouldUpdateCookie = true;
                    }
                } else if (!sessionData.timestamp) {
                    sessionData.timestamp = Date.now();
                    shouldUpdateCookie = true;
                }
            }
        } catch (e) {
            console.warn("[Agent: Proxy] Failed to parse session cookie");
        }
    }

    const walletAddress = sessionData.wallet;
    const privyUserId = sessionData.privyUserId;

    // STRICT ACCESS CONTROL:
    // If no valid session cookie (wallet), DENY ACCESS immediately.
    // This prevents sharing the URL (which contains the encrypted target) to other browsers/users.
    if (!walletAddress) {
        return new NextResponse(
            `<html>
                <head>
                    <title>EconWall - Unauthorized</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet">
                    <style>
                        body {
                            background-color: #000000;
                            color: #ffffff;
                            font-family: 'Geist Mono', monospace;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            text-transform: uppercase;
                        }
                        .container {
                            border: 1px solid #333;
                            padding: 2.5rem;
                            max-width: 420px;
                            text-align: center;
                            background: #000;
                            box-shadow: 4px 4px 0px 0px #333; /* Hard shadow match */
                        }
                        h1 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 1rem; letter-spacing: 0.05em; }
                        p { color: #888; font-size: 0.875rem; margin-bottom: 2rem; line-height: 1.6; text-transform: none; }
                        .btn {
                            display: inline-block;
                            background-color: #fff;
                            color: #000;
                            padding: 12px 24px;
                            text-decoration: none;
                            font-size: 0.875rem;
                            font-weight: 600;
                            border: 1px solid #fff;
                            transition: all 0.2s;
                            box-shadow: 2px 2px 0px 0px #333;
                        }
                        .btn:hover {
                            transform: translate(1px, 1px);
                            box-shadow: 1px 1px 0px 0px #333;
                        }
                        svg { margin-bottom: 1rem; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        ${lockIcon}
                        <h1>Access Denied</h1>
                        <p>No valid session detected.<br/>This proxy URL is bound to a secure session.</p>
                        <a href="${PROXY_BASE}" class="btn">AUTHENTICATE</a>
                    </div>
                </body>
            </html>`,
            { status: 401, headers: { "Content-Type": "text/html" } }
        );
    }

    // Track clicks if we have a wallet
    if (walletAddress) {
        // CHECK IF BLOCKED
        if (isAccessBlocked(walletAddress)) {
            console.warn(`[Agent: Proxy] BLOCKED wallet ${walletAddress.slice(0, 8)}... - Swaps failing`);
            return new NextResponse(
                `<html>
                <head>
                    <title>EconWall - Paused</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet">
                    <style>
                        body {
                            background-color: #000000;
                            color: #ffffff;
                            font-family: 'Geist Mono', monospace;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            text-transform: uppercase;
                        }
                        .container {
                            border: 1px solid #333;
                            padding: 2.5rem;
                            max-width: 420px;
                            text-align: center;
                            background: #000;
                            box-shadow: 4px 4px 0px 0px #333; /* Hard shadow match */
                        }
                        h1 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 1rem; letter-spacing: 0.05em; }
                        p { color: #888; font-size: 0.875rem; margin-bottom: 2rem; line-height: 1.6; text-transform: none; }
                        .btn {
                            display: inline-block;
                            background-color: #fff;
                            color: #000;
                            padding: 12px 24px;
                            text-decoration: none;
                            font-size: 0.875rem;
                            font-weight: 600;
                            border: 1px solid #fff;
                            transition: all 0.2s;
                            box-shadow: 2px 2px 0px 0px #333;
                        }
                        .btn:hover {
                            transform: translate(1px, 1px);
                            box-shadow: 1px 1px 0px 0px #333;
                        }
                        svg { margin-bottom: 1rem; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        ${fuelIcon}
                        <h1>Session Paused</h1>
                        <p>Automatic payments failed due to insufficient ETH.<br/>Please top up your wallet to continue.</p>
                        <a href="${PROXY_BASE}" class="btn">CHECK WALLET</a>
                    </div>
                </body>
            </html>`,
                { status: 402, headers: { "Content-Type": "text/html" } }
            );
        }

        const clickCount = incrementClicks(walletAddress);
        console.log(`[Agent: Proxy] Wallet ${walletAddress.slice(0, 8)}... - Interaction ${clickCount}/${getBatchThreshold()}`);

        // Check if batch swap should be triggered
        if (shouldTriggerSwap(walletAddress) && privyUserId) {

            // Check Lock: Is a swap already running?
            if (isSwapInProgress(walletAddress)) {
                console.log(`[Agent: Proxy] Swap in progress for ${walletAddress.slice(0, 8)}... - Skipping trigger`);
            } else {
                console.log(`[Agent: Proxy] Threshold reached! Autonomous swap initiated...`);
                setSwapLock(walletAddress, true); // LOCK

                // Trigger swap asynchronously (don't block page load)
                triggerBatchSwap(privyUserId).then(success => {
                    setSwapLock(walletAddress, false); // UNLOCK
                    if (success) {
                        resetClicks(walletAddress);
                    }
                });
            }
        }
    }

    const encryptedUrl = req.nextUrl.searchParams.get("u");
    const rawUrl = req.nextUrl.searchParams.get("url"); // Fallback for backwards compat

    let url: string | null = null;

    if (encryptedUrl) {
        // Decrypt the AES encrypted URL
        url = decryptUrl(encryptedUrl);
        if (!url) {
            return new NextResponse(
                `<html><body><h1>Decryption Failed</h1><p>Invalid encrypted URL.</p></body></html>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
            );
        }
    } else if (rawUrl) {
        url = rawUrl;
    }

    if (!url) {
        return new NextResponse(
            `<html><body><h1>Missing URL</h1><p>Please provide a URL to proxy.</p></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
        );
    }

    // Validate URL
    let targetUrl: URL;
    try {
        targetUrl = new URL(url);
    } catch {
        return new NextResponse(
            `<html><body><h1>Invalid URL</h1><p>Please provide a valid URL.</p></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
        );
    }

    try {
        const response = await fetch(targetUrl.href, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });

        if (!response.ok) {
            return new NextResponse(
                `<html><body><h1>Error fetching content</h1><p>Status: ${response.status}</p></body></html>`,
                { status: 502, headers: { "Content-Type": "text/html" } }
            );
        }

        const contentType = response.headers.get("content-type") || "text/html";

        if (contentType.includes("text/html")) {
            let html = await response.text();

            // Inject <base> tag for relative URLs (for assets only)
            html = html.replace(
                /<head>/i,
                `<head><base href="${targetUrl.origin}/">`
            );

            // JavaScript with AES encryption using Web Crypto API
            const proxyScript = `
<script>
(function() {
    var PROXY_ORIGIN = window.location.origin;
    var PROXY_PATH = '/api/proxy?u=';
    var KEY_STRING = '${CLIENT_KEY}';
    
    // Convert string to ArrayBuffer
    function str2ab(str) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0; i < str.length; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }
    
    // Convert ArrayBuffer to hex string
    function ab2hex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(function(b) { return b.toString(16).padStart(2, '0'); })
            .join('');
    }
    
    // AES-256-CBC encrypt using Web Crypto API
    async function encryptUrl(url) {
        var keyData = str2ab(KEY_STRING);
        var key = await crypto.subtle.importKey(
            'raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']
        );
        
        // Generate random 16-byte IV
        var iv = crypto.getRandomValues(new Uint8Array(16));
        
        // Encrypt
        var encoded = new TextEncoder().encode(url);
        var encrypted = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv },
            key,
            encoded
        );
        
        // Return: iv (hex) + ciphertext (hex)
        return ab2hex(iv) + ab2hex(encrypted);
    }
    
    function shouldProxy(url) {
        if (!url) return false;
        if (url.startsWith('javascript:')) return false;
        if (url.startsWith('#')) return false;
        if (url.startsWith('data:')) return false;
        if (url.startsWith(PROXY_ORIGIN)) return false;
        return true;
    }
    
    async function proxyUrl(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.startsWith('/')) {
                url = '${targetUrl.origin}' + url;
            } else {
                url = '${targetUrl.origin}/' + url;
            }
        }
        var encrypted = await encryptUrl(url);
        return PROXY_ORIGIN + PROXY_PATH + encrypted;
    }
    
    // Intercept all link clicks
    document.addEventListener('click', async function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
        }
        if (target && target.href) {
            if (target.closest('#econwall-browser')) return;
            if (!shouldProxy(target.href)) return;
            e.preventDefault();
            e.stopPropagation();
            var proxied = await proxyUrl(target.href);
            window.location.href = proxied;
        }
    }, true);
    
    // Intercept form submissions
    document.addEventListener('submit', async function(e) {
        var form = e.target;
        if (form.closest('#econwall-browser')) return;
        
        var action = form.action || '${targetUrl.href}';
        var method = (form.method || 'GET').toUpperCase();
        
        if (method === 'GET') {
            e.preventDefault();
            e.stopPropagation();
            var formData = new FormData(form);
            var params = new URLSearchParams(formData).toString();
            var newUrl = action + (action.includes('?') ? '&' : '?') + params;
            var proxied = await proxyUrl(newUrl);
            window.location.href = proxied;
        }
    }, true);
    
    // Handle our nav form
    var navForm = document.getElementById('econwall-nav-form');
    if (navForm) {
        navForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            var input = document.getElementById('url-input');
            var url = input.value.trim();
            if (!url) return;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            var encrypted = await encryptUrl(url);
            window.location.href = PROXY_ORIGIN + PROXY_PATH + encrypted;
        });
    }
})();
</script>
`;

            // Obfuscated display (hostname only)
            const displayUrl = targetUrl.hostname;

            // Browser bar UI
            const browserBar = `
<div id="econwall-browser" style="position:fixed;top:0;left:0;right:0;background:hsl(224,71%,4%);border-bottom:1px solid hsl(215,20%,17%);padding:12px 24px;font-family:system-ui,-apple-system,sans-serif;z-index:99999;display:flex;align-items:center;gap:16px;">
    <span style="color:hsl(0,0%,98%);font-weight:600;font-size:14px;letter-spacing:-0.02em;">ECONWALL</span>
    <span style="color:hsl(215,14%,34%);font-size:12px;">BROWSER</span>
    <form id="econwall-nav-form" style="flex:1;display:flex;gap:8px;margin-left:16px;">
        <input id="url-input" type="text" value="${displayUrl}" placeholder="Enter URL..." style="flex:1;padding:10px 16px;border-radius:12px;border:1px solid hsl(215,20%,17%);background:hsl(224,71%,4%);color:hsl(0,0%,98%);font-size:14px;font-family:monospace;outline:none;"/>
        <button type="submit" style="padding:10px 20px;background:hsl(0,0%,98%);color:hsl(224,71%,4%);border:none;border-radius:12px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;">Browse</button>
    </form>
    <a id="econwall-exit" href="#" style="color:hsl(215,14%,34%);text-decoration:none;font-size:12px;font-weight:500;">Exit</a>
</div>
<div style="height:56px;"></div>
<script>document.getElementById('econwall-exit').onclick=function(e){e.preventDefault();window.location.href=window.location.origin+'/';};</script>
`;

            // Inject browser bar after <body>
            html = html.replace(/<body[^>]*>/i, `$&${browserBar}`);
            // Inject proxy script before </body>
            html = html.replace(/<\/body>/i, `${proxyScript}</body>`);

            const finalResponse = new NextResponse(html, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "X-Proxied-From": targetUrl.hostname,
                },
            });

            // UPDATE COOKIE IF TTL TRIGGERED
            if (shouldUpdateCookie && walletAddress) {
                const encryptedSession = encryptUrl(JSON.stringify(sessionData));
                finalResponse.cookies.set("econwall_session", encryptedSession, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    maxAge: 60 * 60 * 24, // 24 hours
                });
                console.log(`[Agent: Proxy] Session timestamp updated for ${walletAddress}`);
            }

            return finalResponse;
        }

        // Pass through other content types
        const body = await response.arrayBuffer();
        const passthroughResponse = new NextResponse(body, {
            status: 200,
            headers: { "Content-Type": contentType },
        });

        if (shouldUpdateCookie && walletAddress) {
            const encryptedSession = encryptUrl(JSON.stringify(sessionData));
            passthroughResponse.cookies.set("econwall_session", encryptedSession, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24, // 24 hours
            });
        }

        return passthroughResponse;

    } catch (error: any) {
        console.error("Proxy error:", error);
        return new NextResponse(
            `<html><body><h1>Proxy Error</h1><p>${error.message}</p></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
        );
    }
}
