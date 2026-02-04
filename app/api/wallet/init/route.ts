import { NextRequest, NextResponse } from "next/server";
import { privy } from "@/lib/privy";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        console.log(`[Wallet Init] Request for ${userId}`);

        let user;
        let isNewUser = false;

        // Step 1: Create or Get User (Simplified)
        // We skip "searching" by custom ID because it hangs.
        // We try to import. If it fails (exists), we recover the ID.
        try {
            user = await privy.importUser({
                linkedAccounts: [{
                    type: 'custom_auth',
                    customUserId: userId
                }],
                createEthereumWallet: false
            });
            isNewUser = true;
            console.log(`[Wallet Init] Created new user ${user.id}`);
        } catch (err: any) {
            // Handle "User already exists" race condition
            if (err.message.includes("already exists")) {
                const match = err.message.match(/did:privy:[a-zA-Z0-9]+/);
                if (match) {
                    try {
                        console.log(`[Wallet Init] User exists, fetching ${match[0]}`);
                        user = await privy.getUser(match[0]);
                    } catch (recErr) {
                        console.error("[Wallet Init] Failed to recover user:", recErr);
                        throw err;
                    }
                } else {
                    throw err;
                }
            } else {
                console.error("[Wallet Init] Failed to create user:", err);
                return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
            }
        }

        // Step 2: Check for Existing Wallet using getWallets
        let wallet;
        try {
            console.log(`[Wallet Init] Checking wallets for Privy ID: ${user.id}`);
            const result = await privy.walletApi.getWallets({ userId: user.id });
            console.log(`[Wallet Init] getWallets found: ${result.data?.length || 0} wallets`);

            const existingWallets = result.data || [];
            wallet = existingWallets.find((w: any) => w.chainType === 'ethereum');
        } catch (e: any) {
            console.log(`[Wallet Init] Failed to fetch wallets: ${e.message}`);
        }

        // Step 3: Create Wallet if Missing
        if (!wallet) {
            console.log(`[Wallet Init] Creating wallet for ${user.id}`);
            try {
                wallet = await privy.walletApi.create({
                    userId: user.id,
                    chainType: 'ethereum'
                });
                console.log(`[Wallet Init] Created new wallet ${wallet.address}`);
            } catch (createErr: any) {
                console.error("[Wallet Init] Failed to create wallet:", createErr);
                throw new Error(`Failed to create wallet: ${createErr.message}`);
            }
        } else {
            console.log(`[Wallet Init] Using existing wallet ${wallet.address}`);
        }

        return NextResponse.json({
            success: true,
            privyUserId: user.id,
            walletAddress: wallet?.address,
            isNew: isNewUser
        });

    } catch (error: any) {
        console.error("Wallet Init Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
