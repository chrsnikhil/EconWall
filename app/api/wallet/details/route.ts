import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArray = any[];

// GET - Get detailed wallet info including transactions
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

        // Get wallet details
        const walletResponse = await client.getWallet({ id: walletId });
        const wallet = walletResponse.data?.wallet;

        if (!wallet) {
            return NextResponse.json(
                { error: "Wallet not found" },
                { status: 404 }
            );
        }

        // Get token balances
        let balances: AnyArray = [];
        try {
            const balanceResponse = await client.getWalletTokenBalance({ id: walletId });
            balances = balanceResponse.data?.tokenBalances || [];
        } catch {
            // Ignore balance errors
        }

        // Get transaction history
        let transactions: AnyArray = [];
        try {
            const txResponse = await client.listTransactions({
                walletIds: [walletId],
                pageSize: 10,
            });
            transactions = txResponse.data?.transactions || [];
        } catch {
            // Ignore transaction errors
        }

        return NextResponse.json({
            success: true,
            wallet: {
                id: wallet.id,
                address: wallet.address,
                blockchain: wallet.blockchain,
                state: wallet.state,
                accountType: (wallet as unknown as Record<string, unknown>).accountType || "EOA",
                createDate: wallet.createDate,
                updateDate: wallet.updateDate,
                name: wallet.name,
                refId: wallet.refId,
            },
            balances,
            transactions: transactions.map((tx: Record<string, unknown>) => ({
                id: tx.id,
                type: tx.transactionType,
                state: tx.state,
                amounts: tx.amounts,
                tokenId: tx.tokenId,
                sourceAddress: tx.sourceAddress,
                destinationAddress: tx.destinationAddress,
                txHash: tx.txHash,
                networkFee: tx.networkFee,
                createDate: tx.createDate,
                operation: tx.operation,
            })),
        });
    } catch (error) {
        console.error("Error getting wallet details:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get wallet details" },
            { status: 500 }
        );
    }
}

