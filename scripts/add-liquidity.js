require('dotenv').config({ path: '.env.local' });
const { createWalletClient, createPublicClient, http, parseEther, parseUnits, encodePacked, encodeAbiParameters, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { unichainSepolia } = require('viem/chains');
const { Pool, Position } = require('@uniswap/v4-sdk');
const { Token, Ether } = require('@uniswap/sdk-core');

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
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'; // Permit2 contract
const STATE_VIEW_ADDRESS = process.env.NEXT_PUBLIC_STATE_VIEW_ADDRESS;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Chain ID for Unichain Sepolia
const CHAIN_ID = 1301;

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
// ACTIONS
// ========================================
const ACTIONS = {
    MINT_POSITION: 0x02,
    SETTLE_PAIR: 0x0d,
    SWEEP: 0x04,  // Required for ETH positions
};

// ========================================
// ABIS
// ========================================
const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function decimals() public view returns (uint8)',
    'function balanceOf(address account) public view returns (uint256)'
]);

const PERMIT2_ABI = parseAbi([
    'function approve(address token, address spender, uint160 amount, uint48 expiration) external'
]);

const STATE_VIEW_ABI = parseAbi([
    'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)'
]);

const POSITION_MANAGER_ABI = parseAbi([
    'function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable'
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

    // Import keccak256 from viem
    const { keccak256 } = require('viem');
    return keccak256(poolKey);
}

// ========================================
// MAIN
// ========================================
async function main() {
    console.log(`🔌 Connected: ${account.address}\n`);

    // ========================================
    // STEP 1: Define Pool Parameters
    // ========================================
    const token0Address = NATIVE_ETH;
    const token1Address = EWT_ADDRESS;
    const fee = 3000;
    const tickSpacing = 60; // For 0.3% fee tier
    const hooks = NATIVE_ETH; // No hooks

    console.log("📋 Pool Configuration:");
    console.log(`   Token0 (ETH): ${token0Address}`);
    console.log(`   Token1 (EWT): ${token1Address}`);
    console.log(`   Fee: ${fee / 10000}%`);
    console.log(`   Tick Spacing: ${tickSpacing}\n`);

    // ========================================
    // STEP 2: Get EWT Decimals
    // ========================================
    console.log("🔍 Fetching EWT token decimals...");
    const ewtDecimals = await publicClient.readContract({
        address: EWT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'decimals'
    });
    console.log(`   EWT Decimals: ${ewtDecimals}\n`);

    // ========================================
    // STEP 3: Create Token Instances
    // ========================================
    const token0 = Ether.onChain(CHAIN_ID);
    const token1 = new Token(CHAIN_ID, token1Address, ewtDecimals, 'EWT', 'Energy Web Token');

    console.log("✅ Token instances created\n");

    // ========================================
    // STEP 4: Compute Pool ID
    // ========================================
    const poolId = getPoolId(token0Address, token1Address, fee, tickSpacing, hooks);
    console.log(`🆔 Pool ID: ${poolId}\n`);

    // ========================================
    // STEP 5: Fetch Pool State
    // ========================================
    console.log("📊 Fetching pool state from StateView...");

    const [slot0, currentLiquidity] = await Promise.all([
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

    const sqrtPriceX96 = slot0[0];
    const currentTick = slot0[1];

    console.log(`   SqrtPriceX96: ${sqrtPriceX96}`);
    console.log(`   Current Tick: ${currentTick}`);
    console.log(`   Current Liquidity: ${currentLiquidity}\n`);

    if (sqrtPriceX96 === 0n) {
        console.error("❌ Pool not initialized! Run init-pool.js first.");
        process.exit(1);
    }

    // ========================================
    // STEP 6: Create Pool Instance
    // ========================================
    console.log("🏊 Creating Pool instance...");
    const pool = new Pool(
        token0,
        token1,
        fee,
        tickSpacing,
        hooks,
        sqrtPriceX96.toString(),
        currentLiquidity.toString(),
        Number(currentTick)
    );
    console.log("✅ Pool instance created\n");

    // ========================================
    // STEP 7: Define Position Parameters
    // ========================================
    // Calculate tick range (full range for simplicity)
    const tickLower = -887220; // Multiple of 60
    const tickUpper = 887220;  // Multiple of 60

    // Define amounts to deposit
    const ethAmount = "0.01"; // 0.01 ETH
    const ewtAmount = "10";    // 10 EWT

    console.log("💰 Desired deposit amounts:");
    console.log(`   ETH: ${ethAmount}`);
    console.log(`   EWT: ${ewtAmount}\n`);

    const amount0Desired = parseEther(ethAmount);
    const amount1Desired = parseUnits(ewtAmount, ewtDecimals);

    // ========================================
    // STEP 8: Calculate Position Using SDK
    // ========================================
    console.log("🧮 Calculating position parameters...");

    const position = Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0: amount0Desired.toString(), // Convert to string
        amount1: amount1Desired.toString(), // Convert to string
        useFullPrecision: true
    });

    const liquidity = BigInt(position.liquidity.toString());
    const mintAmounts = position.mintAmounts;
    const amount0Max = BigInt(mintAmounts.amount0.toString());
    const amount1Max = BigInt(mintAmounts.amount1.toString());

    console.log(`   Calculated Liquidity: ${liquidity}`);
    console.log(`   Amount0 Max: ${amount0Max} (${Number(amount0Max) / 1e18} ETH)`);
    console.log(`   Amount1 Max: ${amount1Max} (${Number(amount1Max) / 10 ** ewtDecimals} EWT)\n`);

    // ========================================
    // STEP 9: Check Balances
    // ========================================
    console.log("💼 Checking balances...");

    const ethBalance = await publicClient.getBalance({ address: account.address });
    const ewtBalance = await publicClient.readContract({
        address: EWT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
    });

    console.log(`   ETH Balance: ${ethBalance} (${Number(ethBalance) / 1e18} ETH)`);
    console.log(`   EWT Balance: ${ewtBalance} (${Number(ewtBalance) / 10 ** ewtDecimals} EWT)\n`);

    if (ethBalance < amount0Max) {
        console.error("❌ Insufficient ETH balance!");
        process.exit(1);
    }

    if (ewtBalance < amount1Max) {
        console.error("❌ Insufficient EWT balance!");
        process.exit(1);
    }

    // ========================================
    // STEP 10: Approve EWT to Permit2
    // ========================================
    console.log("✍️  Step 1: Approving EWT for Permit2...");

    // Approve Permit2 (V4's token transfer system) with unlimited approval
    const { maxUint256 } = require('viem');
    const approveHash = await walletClient.writeContract({
        address: EWT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, maxUint256] // Unlimited approval
    });

    console.log(`   Tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("   ✅ Approved Permit2!\n");

    // ========================================
    // STEP 10.5: Approve PositionManager on Permit2
    // ========================================
    console.log("✍️  Step 2: Allowing PositionManager to spend via Permit2...");

    // Permit2 needs to approve PositionManager as a spender
    // Max uint160 for amount, far future expiration
    const maxUint160 = 2n ** 160n - 1n;
    const farFutureExpiration = Math.floor(Date.now() / 1000) + 31536000; // 1 year from now

    const permit2ApproveHash = await walletClient.writeContract({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [
            EWT_ADDRESS,              // token
            POSITION_MANAGER,          // spender (PositionManager)
            maxUint160,               // amount (max uint160)
            farFutureExpiration       // expiration (1 year)
        ]
    });

    console.log(`   Tx: ${permit2ApproveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: permit2ApproveHash });
    console.log("   ✅ PositionManager can now spend EWT via Permit2!\n");

    // ========================================
    // STEP 11: Encode Position Manager Commands
    // ========================================
    console.log("📝 Encoding Position Manager commands...");

    const poolKey = {
        currency0: token0Address,
        currency1: token1Address,
        fee: fee,
        tickSpacing: tickSpacing,
        hooks: hooks
    };

    // Encode MINT_POSITION parameters
    const mintParams = encodeAbiParameters(
        [
            {
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ],
                name: 'poolKey',
                type: 'tuple'
            },
            { name: 'tickLower', type: 'int24' },
            { name: 'tickUpper', type: 'int24' },
            { name: 'liquidity', type: 'uint256' },
            { name: 'amount0Max', type: 'uint128' },
            { name: 'amount1Max', type: 'uint128' },
            { name: 'recipient', type: 'address' },
            { name: 'hookData', type: 'bytes' }
        ],
        [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, account.address, "0x"]
    );

    // Encode SETTLE_PAIR parameters
    const settleParams = encodeAbiParameters(
        [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' }
        ],
        [token0Address, token1Address]
    );

    // Encode actions (try without SWEEP for minting)
    const actions = encodePacked(
        ['uint8', 'uint8'],
        [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR]
    );

    // Combine parameters (2 params - no SWEEP)
    const params = [mintParams, settleParams];

    // Encode unlockData
    const unlockData = encodeAbiParameters(
        [
            { name: 'actions', type: 'bytes' },
            { name: 'params', type: 'bytes[]' }
        ],
        [actions, params]
    );

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    console.log("✅ Commands encoded\n");

    // ========================================
    // STEP 12: Execute Transaction
    // ========================================
    console.log("🚀 Executing modifyLiquidities...");
    console.log(`   Sending ${Number(amount0Max) / 1e18} ETH with transaction\n`);

    try {
        const hash = await walletClient.writeContract({
            address: POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'modifyLiquidities',
            args: [unlockData, deadline],
            value: amount0Max + parseEther("0.01") // Send extra ETH to be safe, excess will be refunded
        });

        console.log(`   📤 Transaction sent: ${hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        console.log(`\n✅ SUCCESS! Liquidity added!`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed}`);
        console.log(`\n🎉 You can now perform swaps on this pool!`);

    } catch (error) {
        console.error("\n❌ Transaction failed:");
        console.error(error);

        // Try to decode revert reason
        if (error.data) {
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