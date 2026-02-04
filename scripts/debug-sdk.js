require('dotenv').config({ path: '.env.local' });
const { encodeAbiParameters, keccak256, parseAbi, createPublicClient, http } = require('viem');
const { unichainSepolia } = require('viem/chains');

const STATE_VIEW_ADDRESS = process.env.NEXT_PUBLIC_STATE_VIEW_ADDRESS;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

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
    console.log("🔍 Debugging Pool Parameters\n");

    // Test different parameter combinations
    const configs = [
        {
            name: "ETH/EWT (fee=3000, tick=60)",
            currency0: NATIVE_ETH,
            currency1: EWT_ADDRESS,
            fee: 3000,
            tickSpacing: 60,
            hooks: NATIVE_ETH
        },
        {
            name: "ETH/EWT (fee=3000, tick=100)",
            currency0: NATIVE_ETH,
            currency1: EWT_ADDRESS,
            fee: 3000,
            tickSpacing: 100,
            hooks: NATIVE_ETH
        }
    ];

    const STATE_VIEW_ABI = parseAbi([
        'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)'
    ]);

    for (const config of configs) {
        const poolId = getPoolId(
            config.currency0,
            config.currency1,
            config.fee,
            config.tickSpacing,
            config.hooks
        );

        console.log(`\n📋 ${config.name}`);
        console.log(`   Pool ID: ${poolId}`);

        try {
            const slot0 = await publicClient.readContract({
                address: STATE_VIEW_ADDRESS,
                abi: STATE_VIEW_ABI,
                functionName: 'getSlot0',
                args: [poolId]
            });

            const sqrtPriceX96 = slot0[0];
            console.log(`   SqrtPriceX96: ${sqrtPriceX96}`);

            if (sqrtPriceX96 !== 0n) {
                console.log(`   ✅ THIS POOL IS INITIALIZED!`);
                console.log(`   Current Tick: ${slot0[1]}`);
                console.log(`   LP Fee: ${slot0[3]}`);
            } else {
                console.log(`   ❌ Pool not initialized`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
}

main();