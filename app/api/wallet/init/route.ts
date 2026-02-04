import { NextRequest, NextResponse } from "next/server";
import { privy } from "@/lib/privy";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing userId (Metamask Address)" }, { status: 400 });
        }

        const normalizedAddress = userId.toLowerCase();
        console.log(`[Wallet Init] Request for User: ${normalizedAddress}`);

        let user;
        let isNewUser = false;

        // Step 1: Create or Get User
        try {
            user = await privy.importUser({
                linkedAccounts: [{
                    type: 'custom_auth',
                    customUserId: normalizedAddress
                }],
                createEthereumWallet: false
            });
            isNewUser = true;
            console.log(`[Wallet Init] [NEW] Created Privy user ${user.id} for ${normalizedAddress}`);
        } catch (err: any) {
            if (err.message.toLowerCase().includes("already exists")) {
                console.log(`[Wallet Init] [EXISTING] User ${normalizedAddress} already exists`);

                const match = err.message.match(/did:privy:[a-zA-Z0-9]+/);
                if (match) {
                    user = await privy.getUser(match[0]);
                } else {
                    throw new Error("Could not extract user ID from error");
                }
            } else {
                throw err;
            }
        }

        console.log(`[Wallet Init] Resolved Privy DID: ${user.id}`);

        // Step 2: Check for Existing Wallet for THIS USER
        let wallet;
        try {
            console.log(`[Wallet Init] Querying wallets for owner: ${user.id}`);

            const result = await privy.walletApi.getWallets({
                owner: user.id,
                chainType: 'ethereum'
            });

            console.log(`[Wallet Init] Query returned ${result.data?.length || 0} wallets`);

            // CRITICAL FIX: Filter out orphaned wallets (ownerId: null) 
            // Also ensure the wallet actually belongs to this user ID (belt and suspenders)
            const validWallets = result.data?.filter(w =>
                w.ownerId !== null &&
                (w.ownerId === user.id || w.userId === user.id)
            ) || [];

            console.log(`[Wallet Init] Valid owned wallets for this user: ${validWallets.length}`);

            wallet = validWallets[0];

            if (wallet) {
                console.log(`[Wallet Init] Using existing wallet: ${wallet.address} (Owner: ${wallet.ownerId})`);
            } else {
                console.log(`[Wallet Init] No valid owned wallet found for user ${user.id}, will create`);
            }
        } catch (e: any) {
            console.error(`[Wallet Init] Wallet lookup ERROR: ${e.message}`);
        }

        // Step 3: Create Wallet if Missing
        if (!wallet) {
            console.log(`[Wallet Init] Creating new wallet for ${user.id}...`);
            try {
                // Use the structure from privydocs.md
                wallet = await privy.walletApi.create({
                    owner: { user_id: user.id },
                    chain_type: 'ethereum' as any // Explicitly cast if needed
                });
                console.log(`[Wallet Init] [NEW] Created wallet: ${wallet.address}`);
            } catch (createErr: any) {
                console.error("[Wallet Init] Wallet creation failed (retrying with legacy structure):", createErr);
                try {
                    wallet = await privy.walletApi.create({
                        userId: user.id,
                        chainType: 'ethereum'
                    });
                    console.log(`[Wallet Init] [NEW-FALLBACK] Created wallet: ${wallet.address}`);
                } catch (innerErr: any) {
                    return NextResponse.json({
                        error: `Wallet creation failed: ${innerErr.message}`
                    }, { status: 500 });
                }
            }
        }

        return NextResponse.json({
            success: true,
            privyUserId: user.id,
            walletAddress: wallet?.address,
            isNew: isNewUser
        });

    } catch (error: any) {
        console.error("Critical Wallet Init Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}