require('dotenv').config({ path: '.env.local' });
const { createPublicClient, http, parseAbi, encodeAbiParameters, keccak256 } = require('viem');
const { unichainSepolia } = require('viem/chains');

const STATE_VIEW_ADDRESS = process.env.NEXT_PUBLIC_STATE_VIEW_ADDRESS;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

const STATE_VIEW_ABI = parseAbi([
    'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)'
]);

function getPoolId(currency0, currency1, fee, tickSpacing, hooks) {
    const poolKey = encodeAbiParameters(
        [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' }
        ],
        [currency0, currency1, fee, tickSpacing, hooks]
    );
    return keccak256(poolKey);
}

async function main() {
    console.log("🔍 Checking Pool State...\n");

    const poolId = getPoolId(NATIVE_ETH, EWT_ADDRESS, 3000, 60, NATIVE_ETH);
    console.log(`Pool ID: ${poolId}\n`);

    try {
        const [slot0, liquidity] = await Promise.all([
            publicClient.readContract({
                address: STATE_VIEW_ADDRESS,
                abi: STATE_VIEW_ABI,
                functionName: 'getSlot0',
                args: [poolId]
            }),
            publicClient.readContract({
                address: STATE_VIEW_ADDRESS,
                abi: STATE_VIEW_ABI,
                functionName: 'getLiquidity',
                args: [poolId]
            })
        ]);

        console.log("📊 Pool State:");
        console.log(`   SqrtPriceX96: ${slot0[0]}`);
        console.log(`   Current Tick: ${slot0[1]}`);
        console.log(`   Protocol Fee: ${slot0[2]}`);
        console.log(`   LP Fee: ${slot0[3]}`);
        console.log(`   Liquidity: ${liquidity}\n`);

        if (slot0[0] === 0n) {
            console.log("❌ Pool NOT initialized (SqrtPriceX96 = 0)");
            console.log("   This might be a StateView caching issue.");
            console.log("   Wait 30 seconds and try again, or check on block explorer.\n");
        } else {
            console.log("✅ Pool IS initialized!");
            console.log("   Ready for liquidity addition.\n");
        }

    } catch (error) {
        console.error("❌ Error reading pool state:", error.message);
    }
}

main();