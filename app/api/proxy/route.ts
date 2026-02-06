import { NextRequest, NextResponse } from "next/server";
import { encryptUrl, decryptUrl, getClientKey } from "@/lib/url-crypto";
import { incrementClicks, shouldTriggerSwap, resetClicks, getClickCount, getBatchThreshold, isAccessBlocked, isSwapInProgress, setSwapLock } from "@/lib/browse-session";

import { createPublicClient, http, formatEther, encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { unichainSepolia } from "@/lib/wagmi";

// The encryption key for client-side (embedded in injected JS)
const CLIENT_KEY = getClientKey();
const PROXY_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SURGE_HOOK_ADDRESS = process.env.NEXT_PUBLIC_SURGE_HOOK_ADDRESS as `0x${string}`;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS as `0x${string}`;

// POOL CONSTANTS (Must match creation)
const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as const;
const POOL_KEY = {
    currency0: NATIVE_ETH,
    currency1: EWT_ADDRESS,
    fee: 0x800000, // Dynamic fee flag
    tickSpacing: 60,
    hooks: SURGE_HOOK_ADDRESS
};

// Calculate Pool ID Manually (keccak256(abi.encode(key)))
function getPoolId() {
    const encoded = encodeAbiParameters(
        parseAbiParameters('address, address, uint24, int24, address'),
        [POOL_KEY.currency0, POOL_KEY.currency1, POOL_KEY.fee, POOL_KEY.tickSpacing, POOL_KEY.hooks]
    );
    return keccak256(encoded);
}

// Pre-rendered Lucide Icons (generated via node script to avoid React imports in API Route)
// Lock: <Lock color="white" size={48} />
const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// Fuel: <Fuel color="white" size={48} />
const fuelIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fuel"><line x1="3" x2="15" y1="22" y2="22"></line><line x1="4" x2="14" y1="9" y2="9"></line><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path></svg>`;

// BarChart: <BarChart color="hsl(215,14%,34%)" size={16} />
const chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bar-chart"><line x1="12" x2="12" y1="20" y2="10"></line><line x1="18" x2="18" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="16"></line></svg>`;

const SURGE_HOOK_ABI = [
    {
        inputs: [{ name: "poolId", type: "bytes32" }, { name: "user", type: "address" }],
        name: "getUserStats",
        outputs: [
            { name: "swapsLast10Min", type: "uint256" },
            { name: "multiplier", type: "uint8" },
            { name: "totalSwaps", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "poolId", type: "bytes32" }, { name: "user", type: "address" }],
        name: "getCurrentFee",
        outputs: [{ name: "", type: "uint24" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

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
            // Don't log full error to avoid spam, just status
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

    // STRICT ACCESS CONTROL
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
                // Trigger swap asynchronously
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

            // -------------------------------------------------------------
            // DATA FETCHING FOR UI (Fee Slab, Balance)
            // -------------------------------------------------------------
            let clientStats = {
                swapsLast10Min: "0",
                multiplier: "1",
                totalSwaps: "0",
                currentFee: "0.01",
                ethBalance: "0",
                ewtBalance: "0",
                clicksTowardsBatch: "0" // NEW: Track progress to next swap
            };

            if (walletAddress) {
                try {
                    const poolId = getPoolId();

                    // GET CLICK COUNT directly from session memory
                    const currentClicks = getClickCount(walletAddress);
                    clientStats.clicksTowardsBatch = currentClicks.toString();

                    // Fetch all needed stats in parallel using Promise.allSettled to prevent failures from blocking page load
                    const results = await Promise.allSettled([
                        publicClient.readContract({
                            address: SURGE_HOOK_ADDRESS,
                            abi: SURGE_HOOK_ABI,
                            functionName: "getUserStats",
                            args: [poolId, walletAddress as `0x${string}`],
                        }),
                        publicClient.readContract({
                            address: SURGE_HOOK_ADDRESS,
                            abi: SURGE_HOOK_ABI,
                            functionName: "getCurrentFee",
                            args: [poolId, walletAddress as `0x${string}`],
                        }),
                        publicClient.getBalance({
                            address: walletAddress as `0x${string}`
                        }),
                        publicClient.readContract({
                            address: EWT_ADDRESS,
                            abi: ERC20_ABI,
                            functionName: "balanceOf",
                            args: [walletAddress as `0x${string}`],
                        }),
                    ]);

                    // Process Results
                    if (results[0].status === "fulfilled") {
                        const [swaps, mult, total] = results[0].value;
                        clientStats.swapsLast10Min = swaps.toString();
                        clientStats.multiplier = mult.toString();
                        clientStats.totalSwaps = total.toString();
                    }
                    if (results[1].status === "fulfilled") {
                        // Fee is in pips (5000 = 0.5%), we want percentage
                        const feePips = Number(results[1].value);
                        clientStats.currentFee = (feePips / 10000).toFixed(4);
                    }
                    if (results[2].status === "fulfilled") {
                        clientStats.ethBalance = Number(formatEther(results[2].value)).toFixed(4);
                    }
                    if (results[3].status === "fulfilled") {
                        // EWT: Use 6 decimals to show small accruals
                        clientStats.ewtBalance = Number(formatEther(results[3].value)).toFixed(6);
                    }

                } catch (e) {
                    console.warn("[Agent: Proxy] Failed to fetch live stats for browser UI:", e);
                }
            }

            // -------------------------------------------------------------
            // INJECTION
            // -------------------------------------------------------------

            // Inject <base> tag
            html = html.replace(
                /<head>/i,
                `<head><base href="${targetUrl.origin}/">`
            );

            // Inject Chart.js + Data + Styles
            html = html.replace(
                /<head>/i,
                `<head>
                 <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                 <script>window.ECONWALL_STATS = ${JSON.stringify(clientStats)};</script>
                 <style>
                    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap');
                    @keyframes econSpring {
                        0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                        50% { opacity: 1; transform: scale(1.02) translateY(-2px); }
                        100% { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes econFadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .econ-popup-enter { animation: econSpring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                    .econ-backdrop-enter { animation: econFadeIn 0.2s ease-out forwards; }
                 </style>`
            );

            // JavaScript with AES encryption using Web Crypto API
            const proxyScript = `
<script>
(function() {
    var PROXY_ORIGIN = window.location.origin;
    var PROXY_PATH = '/api/proxy?u=';
    var KEY_STRING = '${CLIENT_KEY}';
    
    // ... Encryption Helpers (str2ab, ab2hex, encryptUrl) ...
    function str2ab(str) { var buf = new ArrayBuffer(str.length); var bufView = new Uint8Array(buf); for (var i = 0; i < str.length; i++) { bufView[i] = str.charCodeAt(i); } return buf; }
    function ab2hex(buffer) { return Array.from(new Uint8Array(buffer)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''); }
    async function encryptUrl(url) {
        var keyData = str2ab(KEY_STRING);
        var key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']);
        var iv = crypto.getRandomValues(new Uint8Array(16));
        var encoded = new TextEncoder().encode(url);
        var encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, encoded);
        return ab2hex(iv) + ab2hex(encrypted);
    }
    
    // ... Navigation Logic ...
    function shouldProxy(url) {
        if (!url) return false;
        if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('data:')) return false;
        if (url.startsWith(PROXY_ORIGIN)) return false;
        return true;
    }
    async function proxyUrl(url) {
        if (!url.startsWith('http')) {
            url = url.startsWith('/') ? '${targetUrl.origin}' + url : '${targetUrl.origin}/' + url;
        }
        var encrypted = await encryptUrl(url);
        return PROXY_ORIGIN + PROXY_PATH + encrypted;
    }
    
    // Event Listeners
    document.addEventListener('click', async function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') { target = target.parentElement; }
        if (target && target.href) {
            if (target.closest('#econwall-browser')) return;
            if (!shouldProxy(target.href)) return;
            e.preventDefault(); e.stopPropagation();
            window.location.href = await proxyUrl(target.href);
        }
    }, true);
    
    document.addEventListener('submit', async function(e) {
        var form = e.target;
        if (form.closest('#econwall-browser')) return;
        var action = form.action || '${targetUrl.href}';
        var method = (form.method || 'GET').toUpperCase();
        if (method === 'GET') {
            e.preventDefault(); e.stopPropagation();
            var formData = new FormData(form);
            var params = new URLSearchParams(formData).toString();
            var newUrl = action + (action.includes('?') ? '&' : '?') + params;
            window.location.href = await proxyUrl(newUrl);
        }
    }, true);
    
    // Nav Bar Form
    var navForm = document.getElementById('econwall-nav-form');
    if (navForm) {
        navForm.addEventListener('submit', async function(e) {
            e.preventDefault(); e.stopPropagation();
            var url = document.getElementById('url-input').value.trim();
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            window.location.href = PROXY_ORIGIN + PROXY_PATH + await encryptUrl(url);
        });
    }

    // ------------------------------------------------------------------
    // CHART.JS VISUALIZATION LOGIC
    // ------------------------------------------------------------------
    
    var statsBtn = document.getElementById('econwall-stats-btn');
    var popup = document.getElementById('econwall-stats-popup');
    var container = document.getElementById('econwall-popup-container');
    var closeBtn = document.getElementById('econwall-popup-close');
    
    if (statsBtn && popup && closeBtn) {
        statsBtn.onclick = function() { 
            popup.style.display = 'flex'; 
            popup.classList.add('econ-backdrop-enter');
            container.classList.add('econ-popup-enter');
            initChart(); 
        };
        closeBtn.onclick = function() { popup.style.display = 'none'; };
        
        // Close on click outside
        popup.onclick = function(e) {
            if (e.target === popup) popup.style.display = 'none';
        }
    }

    function initChart() {
        if (window.econChartInstance) {
            window.econChartInstance.destroy();
        }
        
        var ctx = document.getElementById('econwall-chart').getContext('2d');
        var stats = window.ECONWALL_STATS || { swapsLast10Min: 0 };
        var swaps = parseInt(stats.swapsLast10Min);
        
        // Active Tier Logic
        var activeTier = 0;
        if(swaps >= 4) activeTier = 1;
        if(swaps >= 7) activeTier = 2;
        if(swaps >= 10) activeTier = 3;

        var tierLabels = ['Tier 1', 'Tier 2', 'Tier 3', 'Spam'];
        var multipliers = [1, 3, 6, 10]; 
        var descriptions = ['1-3 Swaps', '4-6 Swaps', '7-9 Swaps', '10+ Swaps'];

        // Helper to generate the Zone Gradient
        function getZoneGradient(context) {
            var chart = context.chart;
            var {ctx, chartArea} = chart;
            if (!chartArea) return null;
            
            // 4 Points = 3 Segments? No, usually 4 distinct regions roughly center-aligned on ticks.
            // Ticks at: 0%, 33%, 66%, 100% of width.
            // Boundaries roughly at: 16.5%, 50%, 83.5%
            
            var gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            
            // Colors
            var activeColor = 'rgba(74, 222, 128, 0.4)'; // Vibrant Green-ish
            if (activeTier === 1) activeColor = 'rgba(251, 191, 36, 0.4)'; // Yellow
            if (activeTier === 2) activeColor = 'rgba(249, 115, 22, 0.4)'; // Orange
            if (activeTier === 3) activeColor = 'rgba(239, 68, 68, 0.4)'; // Red
            
            var dullColor = 'rgba(255, 255, 255, 0.05)';
            
            var c0 = activeTier === 0 ? activeColor : dullColor;
            var c1 = activeTier === 1 ? activeColor : dullColor;
            var c2 = activeTier === 2 ? activeColor : dullColor;
            var c3 = activeTier === 3 ? activeColor : dullColor;

            // Sharp stops for distinct vertical zones
            gradient.addColorStop(0, c0);
            gradient.addColorStop(0.165, c0);
            
            gradient.addColorStop(0.165, c1);
            gradient.addColorStop(0.50, c1);
            
            gradient.addColorStop(0.50, c2);
            gradient.addColorStop(0.835, c2);
            
            gradient.addColorStop(0.835, c3);
            gradient.addColorStop(1, c3);
            
            return gradient;
        }

        // Line Stroke Gradient
        var strokeGradient = ctx.createLinearGradient(0, 0, 300, 0); // Approximate width
        strokeGradient.addColorStop(0, '#4ade80');
        strokeGradient.addColorStop(0.5, '#fbbf24');
        strokeGradient.addColorStop(1, '#ef4444');

        window.econChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: tierLabels,
                datasets: [
                    {
                        label: 'Multiplier',
                        data: multipliers,
                        borderColor: strokeGradient,
                        borderWidth: 3,
                        tension: 0.4,
                        
                        // AREA FILL CONFIG
                        fill: true,
                        backgroundColor: function(context) {
                            return getZoneGradient(context);
                        },
                        
                        pointBackgroundColor: '#000',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 9,
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#000'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        titleFont: { family: 'Geist Mono', size: 12, weight: '700' },
                        bodyFont: { family: 'Geist Mono', size: 11 },
                        borderColor: '#333',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(items) { return tierLabels[items[0].dataIndex]; },
                            label: function(item) {
                                var idx = item.dataIndex;
                                var lines = [
                                    'Multiplier: ' + multipliers[idx] + 'x',
                                    'Activity:   ' + descriptions[idx]
                                ];
                                if (idx === activeTier) {
                                    lines.push('');
                                    lines.push('📍 CURRENT STATUS');
                                }
                                return lines;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        display: false, 
                        min: 0, 
                        max: 12 
                    },
                    x: { 
                        display: true,
                        grid: { display: false, drawBorder: false },
                        ticks: { 
                            color: '#666', 
                            font: { family: 'Geist Mono', size: 10, weight: '600' },
                            padding: 10
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

})();
</script>
`;

            // Obfuscated display (hostname only)
            const displayUrl = targetUrl.hostname;

            // Browser bar UI with Stats Button
            const browserBar = `
<div id="econwall-browser" style="position:fixed;top:0;left:0;right:0;background:hsl(224,71%,4%);border-bottom:1px solid hsl(215,20%,17%);padding:12px 24px;font-family:system-ui,-apple-system,sans-serif;z-index:99999;display:flex;align-items:center;gap:16px;">
    <span style="color:hsl(0,0%,98%);font-weight:600;font-size:14px;letter-spacing:-0.02em;">ECONWALL</span>
    <span style="color:hsl(215,14%,34%);font-size:12px;">BROWSER</span>
    <form id="econwall-nav-form" style="flex:1;display:flex;gap:8px;margin-left:16px;">
        <input id="url-input" type="text" value="${displayUrl}" placeholder="Enter URL..." style="flex:1;padding:10px 16px;border-radius:12px;border:1px solid hsl(215,20%,17%);background:hsl(224,71%,4%);color:hsl(0,0%,98%);font-size:14px;font-family:monospace;outline:none;"/>
        <button type="submit" style="padding:10px 20px;background:hsl(0,0%,98%);color:hsl(224,71%,4%);border:none;border-radius:12px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;">Browse</button>
    </form>
    
    <!-- STATS BUTTON -->
    <button id="econwall-stats-btn" style="background:none;border:none;padding:8px;cursor:pointer;color:hsl(215,14%,54%);display:flex;align-items:center;justify-content:center;transition:all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);" onmouseover="this.style.color='white';this.style.transform='scale(1.1)'" onmouseout="this.style.color='hsl(215,14%,54%)';this.style.transform='scale(1)'">
        ${chartIcon}
    </button>
    
    <a id="econwall-exit" href="#" style="color:hsl(215,14%,34%);text-decoration:none;font-size:12px;font-weight:500;">Exit</a>
</div>

<!-- STATS POPUP -->
<div id="econwall-stats-popup" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:100000;align-items:center;justify-content:center;font-family:'Geist Mono',monospace;">
    <div id="econwall-popup-container" style="background:#000;border:1px solid #333;padding:24px;width:340px;box-shadow:0 20px 50px -12px rgba(0,0,0,0.5);position:relative;border-radius:16px;">
        <button id="econwall-popup-close" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#555;font-size:20px;cursor:pointer;transition:color 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#555'">&times;</button>
        <h2 style="color:#fff;margin:0 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Session Activity</h2>
        <div style="color:#666;font-size:11px;margin-bottom:24px;display:flex;justify-content:space-between;">
            <span>LIVE ON-CHAIN METRICS</span>
            <span>SWAPS: <script>document.write(window.ECONWALL_STATS.swapsLast10Min)</script></span>
        </div>
        
        <div style="margin-bottom:24px;height:160px;">
            <canvas id="econwall-chart"></canvas>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:#888;">
            <div style="border:1px solid #222;padding:12px;border-radius:12px;background:#0a0a0a;">
                <div style="margin-bottom:6px;color:#555;font-size:10px;">SWAP FEE</div>
                <div style="color:#fff;font-size:16px;font-weight:600;"><script>document.write(window.ECONWALL_STATS.currentFee)</script>%</div>
            </div>
            <div style="border:1px solid #222;padding:12px;border-radius:12px;background:#0a0a0a;">
                <div style="margin-bottom:6px;color:#555;font-size:10px;">MULTIPLIER</div>
                <div style="color:${clientStats.multiplier === '1' ? '#4ade80' :
                    clientStats.multiplier === '3' ? '#fbbf24' :
                        clientStats.multiplier === '6' ? '#f97316' : '#ef4444'
                };font-size:16px;font-weight:600;"><script>document.write(window.ECONWALL_STATS.multiplier)</script>x</div>
            </div>
            <div style="border:1px solid #222;padding:12px;grid-column:span 2;border-radius:12px;background:#0a0a0a;">
                <div style="margin-bottom:6px;color:#555;font-size:10px;">WALLET BALANCE</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#fff;font-weight:500;"><script>document.write(window.ECONWALL_STATS.ethBalance)</script> ETH</span>
                    <div style="text-align:right;">
                        <span style="color:#4ade80;font-weight:500;background:rgba(74,222,128,0.1);padding:4px 8px;border-radius:6px;display:inline-block;"><script>document.write(window.ECONWALL_STATS.ewtBalance)</script> EWT</span>
                        <div style="font-size:9px;color:#555;margin-top:2px;">BATCH: <script>document.write(window.ECONWALL_STATS.clicksTowardsBatch)</script>/10</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
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
