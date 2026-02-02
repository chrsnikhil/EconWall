
import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle";

// GET - Fetch transaction history for a wallet
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const walletId = searchParams.get("walletId");

        if (!walletId) {
            return NextResponse.json({ error: "walletId required" }, { status: 400 });
        }

        const client = getCircleClient();

        // Fetch all transactions for this wallet
        const response = await client.listTransactions({
            walletIds: [walletId],
            pageSize: 50, // Get last 50 transactions
        });

        const transactions = response.data?.transactions || [];

        // Filter for contract executions (swaps)
        const swaps = transactions.filter(tx =>
            tx.transactionType === "OUTBOUND" &&
            tx.operation === "CONTRACT_EXECUTION"
        );

        // Calculate stats
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        const swapsLastMinute = swaps.filter(tx =>
            new Date(tx.createDate || 0).getTime() > oneMinuteAgo
        ).length;

        const swapsLastHour = swaps.filter(tx =>
            new Date(tx.createDate || 0).getTime() > oneHourAgo
        ).length;

        const swapsLastDay = swaps.filter(tx =>
            new Date(tx.createDate || 0).getTime() > oneDayAgo
        ).length;

        return NextResponse.json({
            success: true,
            stats: {
                totalSwaps: swaps.length,
                swapsLastMinute,
                swapsLastHour,
                swapsLastDay,
            },
            recentSwaps: swaps.slice(0, 10).map(tx => ({
                id: tx.id,
                state: tx.state,
                createDate: tx.createDate,
                txHash: tx.txHash,
            })),
        });
    } catch (e: any) {
        console.error("Failed to fetch swap history:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
