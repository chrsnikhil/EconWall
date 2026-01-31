import { NextRequest, NextResponse } from "next/server";

// Mock ENS resolution API
// This simulates checking if an ENS domain requires payment

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "No query provided" }, { status: 400 });
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock logic: Randomly block or allow access
    // In production, this would check actual ENS records and access tokens
    const isBlocked = Math.random() > 0.5;

    if (isBlocked) {
        // Simulate surge pricing
        const price = (Math.random() * 10 + 1).toFixed(2);
        return NextResponse.json({
            status: "BLOCKED",
            price: price,
            message: "High traffic detected. Surge protection active.",
        });
    } else {
        // Allow access - return a mock URL
        return NextResponse.json({
            status: "OPEN",
            url: `https://example.com/${query.replace(".eth", "")}`,
            message: "Access granted",
        });
    }
}
