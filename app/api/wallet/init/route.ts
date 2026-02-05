import { NextRequest, NextResponse } from "next/server";
import { privy } from "@/lib/privy";

/**
 * Wallet Init API - Simplified for Embedded Wallet Flow
 * 
 * This API now only handles USER LOOKUP, not wallet creation.
 * Embedded wallets are created automatically by the Privy SDK on the client.
 * 
 * Flow:
 * 1. User logs into Privy (client-side) → Embedded wallet auto-created
 * 2. This API just fetches user data for display/verification
 */
export async function POST(req: NextRequest) {
    try {
        const { privyUserId } = await req.json();

        if (!privyUserId) {
            return NextResponse.json({ error: "Missing privyUserId" }, { status: 400 });
        }

        console.log(`[Wallet Init] Looking up user: ${privyUserId}`);

        // Fetch user from Privy
        const user = await privy.getUser(privyUserId);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Find embedded wallet (created by Privy SDK on client)
        const embeddedWallet = user.linkedAccounts?.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy'
        ) as any;

        // For TEE wallets, "ready" means the wallet exists and has an ID
        // The server can sign via the authorization key once the user adds signers
        const hasWallet = !!embeddedWallet;
        const walletId = embeddedWallet?.id;

        console.log(`[Wallet Init] User ${privyUserId}:`);
        console.log(`  - Embedded Wallet: ${embeddedWallet?.address || 'None'}`);
        console.log(`  - Wallet ID: ${walletId || 'None'}`);

        return NextResponse.json({
            success: true,
            privyUserId: user.id,
            embeddedWallet: embeddedWallet ? {
                address: embeddedWallet.address,
                id: walletId,
                ready: hasWallet && !!walletId
            } : null
        });

    } catch (error: any) {
        console.error("[Wallet Init] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
