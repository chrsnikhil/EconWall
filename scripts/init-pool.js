require('dotenv').config({ path: '.env.local' });
const { createWalletClient, createPublicClient, http, parseAbi, encodeAbiParameters, keccak256 } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { unichainSepolia } = require('viem/chains');

// ========================================
// CONFIG
// ========================================
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY;
if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
    console.error("❌ PRIVATE_KEY missing or invalid in .env.local");
    process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const POSITION_MANAGER = process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS;
const STATE_VIEW_ADDRESS = process.env.NEXT_PUBLIC_STATE_VIEW_ADDRESS;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

const publicClient = createPublicClient({
    chain: unichainSepolia,
    transport: http(),
});

const walletClient = createWalletClient({
    account,
    chain: unichainSepolia,
    transport: http(),
});

// ========================================
// ABIS
// ========================================
const POSITION_MANAGER_ABI = [
    {
        name: 'initializePool',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ]
            },
            { name: 'sqrtPriceX96', type: 'uint160' }
        ],
        outputs: [{ name: '', type: 'int24' }]
    }
];

const STATE_VIEW_ABI = parseAbi([
    'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)'
]);

// ========================================
// HELPER: Compute Pool ID
// ========================================
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

// ========================================
// HELPER: Calculate sqrtPriceX96 for 1:1 price
// ========================================
function getSqrtPriceX96For1to1() {
    // For a 1:1 price (1 token0 = 1 token1):
    // sqrtPrice = sqrt(1) * 2^96 = 2^96
    // This is: 79228162514264337593543950336
    return 79228162514264337593543950336n;
}

// ========================================
// HELPER: Calculate sqrtPriceX96 for custom price
// ========================================
function getSqrtPriceX96(token1PerToken0) {
    // sqrtPriceX96 = sqrt(token1/token0) * 2^96
    // Example: If 1 ETH = 1000 EWT, then token1PerToken0 = 1000
    const Q96 = 2n ** 96n;
    const price = BigInt(Math.floor(token1PerToken0 * 1e18));
    const sqrtPrice = BigInt(Math.floor(Math.sqrt(Number(price) / 1e18) * 1e18));
    return (sqrtPrice * Q96) / BigInt(1e18);
}

// ========================================
// MAIN
// ========================================
async function main() {
    console.log(`🔌 Connected: ${account.address}\n`);

    // ========================================
    // STEP 1: Define Pool Parameters
    // ========================================
    const currency0 = NATIVE_ETH;  // ETH (must be lower address)
    const currency1 = EWT_ADDRESS;  // EWT
    const fee = 3000;               // 0.3% fee
    const tickSpacing = 60;         // Standard for 0.3% fee tier
    const hooks = NATIVE_ETH;       // No hooks (0x0 address)

    console.log("📋 Pool Configuration:");
    console.log(`   Currency0 (ETH): ${currency0}`);
    console.log(`   Currency1 (EWT): ${currency1}`);
    console.log(`   Fee: ${fee / 10000}%`);
    console.log(`   Tick Spacing: ${tickSpacing}`);
    console.log(`   Hooks: ${hooks}\n`);

    // ========================================
    // STEP 2: Verify Currency Order
    // ========================================
    // In Uniswap, currency0 must be < currency1
    const currency0Lower = BigInt(currency0) < BigInt(currency1);

    if (!currency0Lower) {
        console.error("❌ ERROR: currency0 must be < currency1");
        console.error(`   ${currency0} is NOT less than ${currency1}`);
        console.error("   Swap the order in your pool configuration!");
        process.exit(1);
    }

    console.log("✅ Currency order verified (currency0 < currency1)\n");

    // ========================================
    // STEP 3: Calculate Pool ID
    // ========================================
    const poolId = getPoolId(currency0, currency1, fee, tickSpacing, hooks);
    console.log(`🆔 Pool ID: ${poolId}\n`);

    // ========================================
    // STEP 4: Check if Pool Already Initialized
    // ========================================
    console.log("🔍 Checking if pool already exists...");

    try {
        const slot0 = await publicClient.readContract({
            address: STATE_VIEW_ADDRESS,
            abi: STATE_VIEW_ABI,
            functionName: 'getSlot0',
            args: [poolId]
        });

        const sqrtPriceX96 = slot0[0];

        if (sqrtPriceX96 !== 0n) {
            console.log("✅ Pool already initialized!");
            console.log(`   SqrtPriceX96: ${sqrtPriceX96}`);
            console.log(`   Current Tick: ${slot0[1]}`);
            console.log("\n💡 You can skip initialization and go directly to adding liquidity.");
            return;
        }
    } catch (error) {
        // Pool might not exist yet, continue
        console.log("   Pool not found in StateView (will create new)\n");
    }

    // ========================================
    // STEP 5: Calculate Starting Price
    // ========================================
    console.log("💰 Setting initial pool price...");

    // OPTION 1: 1:1 price (1 ETH = 1 EWT)
    const startingPrice = getSqrtPriceX96For1to1();
    console.log(`   Using 1:1 price (1 ETH = 1 EWT)`);

    // OPTION 2: Custom price (uncomment and adjust)
    // const token1PerToken0 = 1000; // Example: 1 ETH = 1000 EWT
    // const startingPrice = getSqrtPriceX96(token1PerToken0);
    // console.log(`   Using custom price: 1 ETH = ${token1PerToken0} EWT`);

    console.log(`   SqrtPriceX96: ${startingPrice}\n`);

    // ========================================
    // STEP 6: Prepare Pool Key
    // ========================================
    const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: fee,
        tickSpacing: tickSpacing,
        hooks: hooks
    };

    // ========================================
    // STEP 7: Initialize Pool
    // ========================================
    console.log("🚀 Initializing pool...");
    console.log("   This transaction will:");
    console.log("   1. Create the pool if it doesn't exist");
    console.log("   2. Set the starting price");
    console.log("   3. Return the initial tick\n");

    try {
        const hash = await walletClient.writeContract({
            address: POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'initializePool',
            args: [poolKey, startingPrice]
        });

        console.log(`   📤 Transaction sent: ${hash}`);
        console.log(`   ⏳ Waiting for confirmation...\n`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        console.log("✅ SUCCESS! Pool initialized!");
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed}\n`);

        // ========================================
        // STEP 8: Verify Initialization
        // ========================================
        console.log("🔍 Verifying pool state...");

        const slot0 = await publicClient.readContract({
            address: STATE_VIEW_ADDRESS,
            abi: STATE_VIEW_ABI,
            functionName: 'getSlot0',
            args: [poolId]
        });

        console.log(`   SqrtPriceX96: ${slot0[0]}`);
        console.log(`   Current Tick: ${slot0[1]}`);
        console.log(`   Protocol Fee: ${slot0[2]}`);
        console.log(`   LP Fee: ${slot0[3]}\n`);

        console.log("🎉 Pool is ready!");
        console.log("📝 Next step: Run add-liquidity-fixed.js to add liquidity\n");

    } catch (error) {
        console.error("\n❌ Initialization failed:");
        console.error(error);

        if (error.message?.includes("already initialized")) {
            console.log("\n💡 Pool already initialized. You can proceed to add liquidity!");
        } else if (error.data) {
            console.error("\nRevert data:", error.data);
        }

        process.exit(1);
    }
}

// ========================================
// RUN
// ========================================
main().catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
});