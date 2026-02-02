
import { createWalletClient, http, publicActions, parseUnits, maxUint256, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from '../lib/wagmi';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const POOL_MANAGER = "0x2fC5F512d31CbF64D0f33eE4A368B2d342189949";
const LP_ROUTER = "0x38482463193d58ee66dCA36447972AE26Adf785C";
const USDC = "0x3600000000000000000000000000000000000000";
const EWT = "0x99793d4F104F2E4DC89A7e00C688d617b2B7C954";

// Price 1e12 => 1 USDC (1e6) = 1 EWT (1e18)
// SqrtPrice = 79228162514264337593543950336000000
const SQRT_PRICE_CORRECT = 79228162514264337593543950336000000n;

// Pool Key: Fee 500 (0.05%)
const poolKey = {
    currency0: USDC,
    currency1: EWT,
    fee: 500,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000"
};

// --- Helper: Load Env ---
function loadPrivateKey() {
    // Try uniswap-v4-deploy-2/.env first
    const envPath = path.resolve(__dirname, '../../uniswap-v4-deploy-2/.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/PRIVATE_KEY=([a-fA-F0-9x]+)/);
        if (match) return match[1].startsWith('0x') ? match[1] : `0x${match[1]}`;
    }
    throw new Error("Could not find PRIVATE_KEY in ../uniswap-v4-deploy-2/.env");
}

async function main() {
    const pk = loadPrivateKey() as `0x${string}`;
    const account = privateKeyToAccount(pk);
    console.log(`Using Account: ${account.address}`);

    const client = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http()
    }).extend(publicActions);

    // --- ABIs ---
    const managerAbi = parseAbi([
        "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)"
    ]);

    const routerAbi = parseAbi([
        "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable returns (int256 delta)"
    ]);

    const erc20Abi = parseAbi([
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
    ]);

    // 1. Initialize
    console.log("Initializing Pool (Fee 500)...");
    try {
        const hash = await client.writeContract({
            address: POOL_MANAGER as `0x${string}`,
            abi: managerAbi,
            functionName: 'initialize',
            args: [poolKey, SQRT_PRICE_CORRECT]
        });
        console.log(`Init Tx sent: ${hash}`);
        await client.waitForTransactionReceipt({ hash });
        console.log("Pool Initialized!");
    } catch (e: any) {
        if (e.message.includes("PoolAlreadyInitialized") || e.message.includes("revert")) {
            console.log("Pool likely initialized, proceeding...");
        } else {
            console.error("Init Error:", e);
        }
    }

    // 2. Approve
    console.log("Approving Tokens...");
    const approveUSDC = await client.writeContract({
        address: USDC as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [LP_ROUTER as `0x${string}`, maxUint256]
    });
    await client.waitForTransactionReceipt({ hash: approveUSDC });

    const approveEWT = await client.writeContract({
        address: EWT as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [LP_ROUTER as `0x${string}`, maxUint256]
    });
    await client.waitForTransactionReceipt({ hash: approveEWT });
    console.log("Approved.");

    // 3. Add Liquidity
    console.log("Adding Liquidity...");

    // Ticks: [270000, 279960] (Multiples of 60, centered around 276324)
    // Liquidity: 1e13
    const params = {
        tickLower: 270000,
        tickUpper: 279960,
        liquidityDelta: 10000000000000n, // 1e13
        salt: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`
    };

    const txL = await client.writeContract({
        address: LP_ROUTER as `0x${string}`,
        abi: routerAbi,
        functionName: 'modifyLiquidity',
        args: [poolKey, params, "0x"]
    });
    console.log(`Liquidity Tx Sent: ${txL}`);
    await client.waitForTransactionReceipt({ hash: txL });
    console.log("Liquidity Added Successfully!");
}

main().catch(console.error);
