import { NextRequest, NextResponse } from "next/server";

// Domain → Real URL mapping (the secrets!)
const DOMAIN_REGISTRY: Record<string, string> = {
    "econwall.eth": "https://chrsnikhil.info", // Your portfolio site
    "ticket.eth": "https://example.com",
    "vip.eth": "https://example.com",
    // Add more domains here
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    const { domain } = await params;

    // 1. Look up the real target URL
    const targetUrl = DOMAIN_REGISTRY[domain];

    if (!targetUrl) {
        return new NextResponse(
            `<html><body><h1>404 - Domain Not Found</h1><p>${domain} is not registered.</p></body></html>`,
            { status: 404, headers: { "Content-Type": "text/html" } }
        );
    }

    try {
        // 2. Fetch the real content (server-side)
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "EconWall-Proxy/1.0",
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

        // 3. For HTML, rewrite to work through proxy
        if (contentType.includes("text/html")) {
            let html = await response.text();

            // Inject <base> tag to make relative URLs work
            html = html.replace(
                /<head>/i,
                `<head><base href="${targetUrl}/">`
            );

            // Add a banner indicating this is proxied (optional, for demo)
            html = html.replace(
                /<body[^>]*>/i,
                `$&<div style="background:linear-gradient(90deg,#6366f1,#8b5cf6);color:white;padding:8px 16px;font-family:system-ui;font-size:14px;text-align:center;">🔒 Accessed via EconWall Portal: <strong>${domain}</strong></div>`
            );

            return new NextResponse(html, {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "X-Proxied-From": domain,
                },
            });
        }

        // 4. For other content types, pass through
        const body = await response.arrayBuffer();
        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
            },
        });

    } catch (error: any) {
        console.error(`Proxy error for ${domain}:`, error);
        return new NextResponse(
            `<html><body><h1>Proxy Error</h1><p>${error.message}</p></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
        );
    }
}
