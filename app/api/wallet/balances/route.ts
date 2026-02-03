import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { unichainSepolia } from "@/lib/wagmi";
import { ERC20_ABI } from "@/lib/wallet-abis";

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

// Known tokens on Unichain Sepolia
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;

const KNOWN_TOKENS: { address: `0x${string}`; symbol: string; decimals: number }[] = [];

if (EWT_ADDRESS && EWT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    KNOWN_TOKENS.push({
        address: EWT_ADDRESS as `0x${string}`,
        symbol: "EWT",
        decimals: 18,
    });
}

/**
 * GET - Fetch balances for a smart wallet
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get("wallet") as `0x${string}`;

        if (!walletAddress) {
            return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
        }

        // Get ETH balance
        const ethBalance = await publicClient.getBalance({ address: walletAddress });

        // Get token balances
        const tokenBalances = await Promise.all(
            KNOWN_TOKENS.map(async (token) => {
                try {
                    const balance = await publicClient.readContract({
                        address: token.address,
                        abi: ERC20_ABI,
                        functionName: "balanceOf",
                        args: [walletAddress],
                    });
                    return {
                        symbol: token.symbol,
                        address: token.address,
                        balance: formatUnits(balance, token.decimals),
                        rawBalance: balance.toString(),
                    };
                } catch {
                    return {
                        symbol: token.symbol,
                        address: token.address,
                        balance: "0",
                        rawBalance: "0",
                    };
                }
            })
        );

        return NextResponse.json({
            success: true,
            wallet: walletAddress,
            balances: {
                eth: {
                    symbol: "ETH",
                    balance: formatEther(ethBalance),
                    rawBalance: ethBalance.toString(),
                },
                tokens: tokenBalances,
            },
        });
    } catch (error: any) {
        console.error("Error fetching balances:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
