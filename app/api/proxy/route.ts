import { NextRequest, NextResponse } from "next/server";
import { decryptUrl, getClientKey } from "@/lib/url-crypto";

// The encryption key for client-side (embedded in injected JS)
const CLIENT_KEY = getClientKey();

// Proxies ANY URL passed as query param (AES encrypted)
export async function GET(req: NextRequest) {
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

            return new NextResponse(html, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "X-Proxied-From": targetUrl.hostname,
                },
            });
        }

        // Pass through other content types
        const body = await response.arrayBuffer();
        return new NextResponse(body, {
            status: 200,
            headers: { "Content-Type": contentType },
        });

    } catch (error: any) {
        console.error("Proxy error:", error);
        return new NextResponse(
            `<html><body><h1>Proxy Error</h1><p>${error.message}</p></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
        );
    }
}
