import { NextRequest, NextResponse } from "next/server";
import { privy } from "@/lib/privy";
import { parseEther, toHex } from "viem";

export async function POST(req: NextRequest) {
    try {
        const { privyUserId, recipient, amount } = await req.json();

        if (!privyUserId || !recipient || !amount) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Wallet Send] Request from ${privyUserId} to ${recipient} (${amount} ETH)`);

        // 1. Get User Wallet
        let wallet;
        try {
            console.log(`[Wallet Send] Fetching wallets for ${privyUserId}...`);
            // FIXED: Use owner filter instead of userId
            const result = await privy.walletApi.getWallets({
                owner: privyUserId,
                chainType: 'ethereum'
            });
            const wallets = result.data || [];
            console.log(`[Wallet Send] Found ${wallets.length} wallets for this user`);

            // Find the ethereum wallet
            wallet = wallets[0];
        } catch (e: any) {
            console.error("[Wallet Send] Failed to fetch wallets:", e.message);
        }

        if (!wallet) {
            console.error(`[Wallet Send] No Ethereum wallet found for user ${privyUserId}`);
            return NextResponse.json({ error: "User has no wallet" }, { status: 404 });
        }

        // 2. Prepare Transaction
        const weiAmount = parseEther(amount.toString());
        const hexValue = toHex(weiAmount);
        const chainId = 1301; // Unichain Sepolia

        console.log(`[Wallet Send] Sending ${amount} ETH from ${wallet.address} to ${recipient}...`);

        // 3. Send Transaction
        const txReceipt = await privy.walletApi.ethereum.sendTransaction({
            walletId: wallet.id,
            caip2: `eip155:${chainId}`,
            transaction: {
                to: recipient,
                value: hexValue,
                chainId: chainId
            }
        });

        console.log(`[Wallet Send] Success! Hash: ${txReceipt.hash}`);

        return NextResponse.json({
            success: true,
            txHash: txReceipt.hash,
            from: wallet.address,
            to: recipient,
            amount: amount
        });

    } catch (error: any) {
        console.error("Wallet Send Error:", error);
        return NextResponse.json({
            error: error.message || "Transaction failed",
            details: error.response?.data || error.stack
        }, { status: 500 });
    }
}
