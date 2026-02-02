
import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
const CUSTOM_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS!;
const SWAP_ROUTER = process.env.NEXT_PUBLIC_SWAP_ROUTER_ADDRESS!;

// Sort tokens (case insensitive)
const isUSDCToken0 = USDC_ADDRESS.toLowerCase() < CUSTOM_TOKEN_ADDRESS.toLowerCase();
const token0 = isUSDCToken0 ? USDC_ADDRESS : CUSTOM_TOKEN_ADDRESS;
const token1 = isUSDCToken0 ? CUSTOM_TOKEN_ADDRESS : USDC_ADDRESS;

export async function POST(req: NextRequest) {
    try {
        const { walletId, amount } = await req.json(); // amount is USDC units (wei string)
        const client = getCircleClient();

        // Exact Input (User provides USDC) -> Negative amountSpecified
        const amountSpecified = (-BigInt(amount)).toString();

        // If input is USDC (token0), then zeroForOne = true.
        const zeroForOne = isUSDCToken0;

        const MIN_SQRT_RATIO = "4295128739";
        const MAX_SQRT_RATIO = "1461446703485210103287273052203988822378723970342";
        const limit = zeroForOne ? (BigInt(MIN_SQRT_RATIO) + 1n).toString() : (BigInt(MAX_SQRT_RATIO) - 1n).toString();

        const tx = await client.createContractExecutionTransaction({
            walletId,
            contractAddress: SWAP_ROUTER,
            abiFunctionSignature: "swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes)",
            abiParameters: [
                [token0, token1, 3000, 60, "0x0000000000000000000000000000000000000000"], // Key
                [zeroForOne, amountSpecified, limit], // Params
                [false, false], // TestSettings
                "0x" // HookData manually encoded? No, SDK handles bytes string.
            ],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        return NextResponse.json({ id: tx.data?.id });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message || JSON.stringify(e) }, { status: 500 });
    }
}
