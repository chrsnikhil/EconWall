import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle";

// GET - List all wallets
export async function GET(request: NextRequest) {
    try {
        const client = getCircleClient();

        // Get all wallet sets first
        const walletSetsResponse = await client.listWalletSets({});
        const walletSets = walletSetsResponse.data?.walletSets || [];

        // Get all wallets with their balances
        const walletsResponse = await client.listWallets({});
        const wallets = walletsResponse.data?.wallets || [];

        // Fetch balances for each wallet
        const walletsWithBalances = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    const balanceResponse = await client.getWalletTokenBalance({
                        id: wallet.id,
                    });
                    return {
                        ...wallet,
                        balances: balanceResponse.data?.tokenBalances || [],
                    };
                } catch {
                    return {
                        ...wallet,
                        balances: [],
                    };
                }
            })
        );

        return NextResponse.json({
            success: true,
            walletSets,
            wallets: walletsWithBalances,
        });
    } catch (error) {
        console.error("Error listing wallets:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list wallets" },
            { status: 500 }
        );
    }
}
