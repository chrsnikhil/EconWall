
import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
const SWAP_ROUTER = process.env.NEXT_PUBLIC_SWAP_ROUTER_ADDRESS!;

export async function POST(req: NextRequest) {
    try {
        const { walletId, amount } = await req.json();
        const client = getCircleClient();

        // Approve 10x amount to be safe
        const approveAmount = (BigInt(amount) * 10n).toString();

        const tx = await client.createContractExecutionTransaction({
            walletId,
            contractAddress: USDC_ADDRESS,
            abiFunctionSignature: "approve(address,uint256)",
            abiParameters: [SWAP_ROUTER, approveAmount],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        return NextResponse.json({ id: tx.data?.id });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
