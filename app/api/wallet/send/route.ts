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

        // 1. Get User
        const user = await privy.getUser(privyUserId);

        // 2. Find their embedded wallet (for TEE, we look for privy walletClientType)
        const embeddedWallet = user.linkedAccounts?.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy'
        ) as any;

        if (!embeddedWallet) {
            console.error(`[Wallet Send] User ${privyUserId} has no embedded wallet.`);
            return NextResponse.json(
                { error: 'User has no embedded wallet. Please create one in the sidebar.' },
                { status: 404 }
            );
        }

        console.log(`[Wallet Send] Found embedded wallet: ${embeddedWallet.address}`);

        // 3. For TEE wallets, we use the wallet ID to send transactions
        // The authorization private key in lib/privy.ts allows signing
        const walletId = embeddedWallet.id;

        if (!walletId) {
            console.error(`[Wallet Send] Wallet has no ID`);
            return NextResponse.json(
                { error: 'Wallet ID not found. Please ensure the wallet has signers enabled.' },
                { status: 400 }
            );
        }

        // 3. Prepare Transaction
        const weiAmount = parseEther(amount.toString());
        const hexValue = toHex(weiAmount);
        const chainId = 1301; // Unichain Sepolia

        // 4. Send Transaction using the wallet ID (server has auth key)
        const txReceipt = await privy.walletApi.ethereum.sendTransaction({
            walletId: walletId,
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
            from: embeddedWallet.address,
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
