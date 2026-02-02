import { NextRequest, NextResponse } from "next/server";
import { getCircleClient, BLOCKCHAIN } from "@/lib/circle";

// POST - Create wallet set and wallets
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletSetName = "EconWall Wallet Set", count = 1 } = body;

        const client = getCircleClient();

        // Create a wallet set
        const walletSetResponse = await client.createWalletSet({
            name: walletSetName,
        });

        const walletSetId = walletSetResponse.data?.walletSet?.id;

        if (!walletSetId) {
            return NextResponse.json(
                { error: "Failed to create wallet set" },
                { status: 500 }
            );
        }

        // Create wallet(s) on Arc Testnet
        const walletsResponse = await client.createWallets({
            blockchains: [BLOCKCHAIN],
            count,
            walletSetId,
        });

        return NextResponse.json({
            success: true,
            walletSet: walletSetResponse.data?.walletSet,
            wallets: walletsResponse.data?.wallets,
        });
    } catch (error) {
        console.error("Error creating wallet:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create wallet" },
            { status: 500 }
        );
    }
}

// GET - Get wallet balance
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const walletId = searchParams.get("walletId");

        if (!walletId) {
            return NextResponse.json(
                { error: "walletId is required" },
                { status: 400 }
            );
        }

        const client = getCircleClient();

        const response = await client.getWalletTokenBalance({
            id: walletId,
        });

        return NextResponse.json({
            success: true,
            balances: response.data?.tokenBalances,
        });
    } catch (error) {
        console.error("Error getting balance:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get balance" },
            { status: 500 }
        );
    }
}
