import { NextRequest, NextResponse } from "next/server";
import { getCircleClient, ARC_TOKENS, BLOCKCHAIN } from "@/lib/circle";

// POST - Transfer USDC or EURC
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            amount,
            senderAddress,
            destinationAddress,
            token = "USDC", // "USDC" or "EURC"
        } = body;

        if (!amount || !senderAddress || !destinationAddress) {
            return NextResponse.json(
                { error: "amount, senderAddress, and destinationAddress are required" },
                { status: 400 }
            );
        }

        const tokenAddress = token === "EURC" ? ARC_TOKENS.EURC : ARC_TOKENS.USDC;

        const client = getCircleClient();

        const transferResponse = await client.createTransaction({
            amount: [amount.toString()],
            destinationAddress,
            tokenAddress,
            blockchain: BLOCKCHAIN,
            walletAddress: senderAddress,
            fee: {
                type: "level",
                config: {
                    feeLevel: "MEDIUM",
                },
            },
        });

        return NextResponse.json({
            success: true,
            transaction: transferResponse.data,
        });
    } catch (error) {
        console.error("Error creating transfer:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create transfer" },
            { status: 500 }
        );
    }
}

// GET - Check transaction status
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const transactionId = searchParams.get("transactionId");

        if (!transactionId) {
            return NextResponse.json(
                { error: "transactionId is required" },
                { status: 400 }
            );
        }

        const client = getCircleClient();

        const response = await client.getTransaction({
            id: transactionId,
        });

        return NextResponse.json({
            success: true,
            transaction: response.data?.transaction,
        });
    } catch (error) {
        console.error("Error getting transaction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get transaction" },
            { status: 500 }
        );
    }
}
