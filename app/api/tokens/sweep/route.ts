
import { NextRequest, NextResponse } from "next/server";
import { getCircleClient, BLOCKCHAIN } from "@/lib/circle";

// Dump address - where expired tokens go (could be treasury or burn address)
const DUMP_ADDRESS = "0x000000000000000000000000000000000000dEaD"; // Dead address
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS!;

// POST - Sweep all EWT tokens from all wallets to dump address
// This can be triggered by a cron job or manually
export async function POST(req: NextRequest) {
    try {
        // Optional: Add secret key check to prevent unauthorized calls
        const { secret } = await req.json().catch(() => ({}));
        const expectedSecret = process.env.SWEEP_SECRET || "sweep-tokens-secret";

        if (secret !== expectedSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = getCircleClient();

        // 1. List all wallets
        const walletsResponse = await client.listWallets({
            blockchain: BLOCKCHAIN,
            pageSize: 100,
        });

        const wallets = walletsResponse.data?.wallets || [];
        const results: { walletId: string; address: string; amount: string; status: string }[] = [];

        for (const wallet of wallets) {
            try {
                // 2. Get EWT balance for each wallet
                const balanceRes = await client.getWalletTokenBalance({
                    id: wallet.id!,
                    tokenAddress: EWT_ADDRESS,
                });

                const balance = balanceRes.data?.tokenBalance?.amount || "0";

                if (balance !== "0" && BigInt(balance) > 0n) {
                    // 3. Transfer all EWT to dump address
                    const transferRes = await client.createContractExecutionTransaction({
                        walletId: wallet.id!,
                        contractAddress: EWT_ADDRESS,
                        abiFunctionSignature: "transfer(address,uint256)",
                        abiParameters: [DUMP_ADDRESS, balance],
                        fee: { type: "level", config: { feeLevel: "LOW" } }
                    });

                    results.push({
                        walletId: wallet.id!,
                        address: wallet.address!,
                        amount: balance,
                        status: `Swept: ${transferRes.data?.id}`
                    });
                } else {
                    results.push({
                        walletId: wallet.id!,
                        address: wallet.address!,
                        amount: "0",
                        status: "No EWT to sweep"
                    });
                }
            } catch (walletError: any) {
                results.push({
                    walletId: wallet.id!,
                    address: wallet.address || "unknown",
                    amount: "?",
                    status: `Error: ${walletError.message}`
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${wallets.length} wallets`,
            timestamp: new Date().toISOString(),
            results,
        });
    } catch (e: any) {
        console.error("Sweep failed:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET - Status check
export async function GET() {
    return NextResponse.json({
        endpoint: "EWT Token Sweep",
        description: "POST to sweep all EWT tokens from all wallets to dump address",
        dumpAddress: DUMP_ADDRESS,
        usage: "POST with { secret: 'your-secret' }",
    });
}
