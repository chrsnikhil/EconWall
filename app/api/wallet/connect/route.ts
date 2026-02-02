import { NextRequest, NextResponse } from "next/server";
import { getCircleClient, BLOCKCHAIN } from "@/lib/circle";

// POST - Find or create Arc wallet for a MetaMask address
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { metamaskAddress } = body;

        if (!metamaskAddress) {
            return NextResponse.json(
                { error: "metamaskAddress is required" },
                { status: 400 }
            );
        }

        // Normalize address to lowercase
        const normalizedAddress = metamaskAddress.toLowerCase();

        const client = getCircleClient();

        // Search for existing wallet with this refId (metamask address)
        const walletsResponse = await client.listWallets({
            refId: normalizedAddress,
        });

        const existingWallets = walletsResponse.data?.wallets || [];

        // If wallet exists, return it
        if (existingWallets.length > 0) {
            const wallet = existingWallets[0];

            // Get balance
            let balances = [];
            try {
                const balanceResponse = await client.getWalletTokenBalance({
                    id: wallet.id,
                });
                balances = balanceResponse.data?.tokenBalances || [];
            } catch {
                // Ignore balance fetch errors
            }

            return NextResponse.json({
                success: true,
                isNew: false,
                wallet: {
                    ...wallet,
                    balances,
                },
            });
        }

        // No existing wallet found - create a new one
        // First, get or create a wallet set for user wallets
        let walletSetId: string;

        const walletSetsResponse = await client.listWalletSets({});
        const userWalletSet = walletSetsResponse.data?.walletSets?.find(
            (ws) => ws.name === "User Wallets"
        );

        if (userWalletSet) {
            walletSetId = userWalletSet.id;
        } else {
            // Create a new wallet set for user wallets
            const newWalletSetResponse = await client.createWalletSet({
                name: "User Wallets",
            });
            walletSetId = newWalletSetResponse.data?.walletSet?.id || "";
        }

        if (!walletSetId) {
            return NextResponse.json(
                { error: "Failed to get wallet set" },
                { status: 500 }
            );
        }

        // Create new wallet with refId set to metamask address
        const createWalletResponse = await client.createWallets({
            blockchains: [BLOCKCHAIN],
            count: 1,
            walletSetId,
            metadata: [
                {
                    refId: normalizedAddress,
                    name: `Arc Wallet for ${normalizedAddress.slice(0, 8)}...`,
                },
            ],
        });

        const newWallet = createWalletResponse.data?.wallets?.[0];

        if (!newWallet) {
            return NextResponse.json(
                { error: "Failed to create wallet" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            isNew: true,
            wallet: {
                ...newWallet,
                balances: [],
            },
        });
    } catch (error) {
        console.error("Error connecting wallet:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to connect wallet" },
            { status: 500 }
        );
    }
}
