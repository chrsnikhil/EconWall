import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import { Currency, Ether, Token } from '@uniswap/sdk-core';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Constants
const UNIVERSAL_ROUTER = process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS;
const EWT_ADDRESS = process.env.NEXT_PUBLIC_CUSTOM_TOKEN_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const UNICHAIN_SEPOLIA_ID = 1301;

// Chain Config
const unichainSepolia = {
    id: UNICHAIN_SEPOLIA_ID,
    name: 'Unichain Sepolia',
    network: 'unichain-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://sepolia.unichain.org'] },
        public: { http: ['https://sepolia.unichain.org'] },
    },
};

// Addresses
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

async function main() {
    console.log("=== Testing Universal Router Swap (EOA) ===");
    console.log("Router:", UNIVERSAL_ROUTER);
    console.log("EWT:", EWT_ADDRESS);

    // Setup Clients
    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({ account, chain: unichainSepolia, transport: http() });
    const publicClient = createPublicClient({ chain: unichainSepolia, transport: http() });

    // Define Tokens
    // use Native ETH
    const ETH_TOKEN = Ether.onChain(UNICHAIN_SEPOLIA_ID);
    const EWT_TOKEN = new Token(UNICHAIN_SEPOLIA_ID, EWT_ADDRESS, 18, 'EWT', 'EconWall Token');

    // Define Pool Key
    const poolKey = {
        currency0: ADDRESS_ZERO, // Native ETH
        currency1: EWT_ADDRESS,
        fee: 3000,
        tickSpacing: 100,
        hooks: ADDRESS_ZERO,
    };

    // Swap Params
    const amountIn = parseEther("0.0001");
    // const amountOutMin = 0n; // Accept 0 for test (bad for prod)

    // Config for V4Planner
    const swapConfig = {
        poolKey,
        zeroForOne: true, // ETH -> EWT
        amountIn: amountIn.toString(),
        amountOutMinimum: "0",
        hookData: "0x",
    };

    // Plan V4 Actions
    const v4Planner = new V4Planner();

    // 1. SWAP
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);

    // 2. SETTLE (ETH). Router needs to pay Manager.
    // Settling Currency0 (ETH)
    v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, amountIn.toString()]);

    // 3. TAKE (EWT). Router takes EWT from Manager.
    // Taking Currency1 (EWT)
    v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, "0"]); // 0 min out

    const encodedV4Actions = v4Planner.finalize();

    // Plan Universal Router Command
    const routePlanner = new RoutePlanner();
    routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions, v4Planner.inputs]); // Updated: SDK might use different property names? 
    // Wait, check SDK docs usage. 
    // Docs: routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])?? 
    // In SDK source, finalize returns encoded actions? 
    // Actually, V4Planner usually tracks actions internally.

    // Let's rely on standard Universal Router SDK usage pattern:
    // routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]); -> This is usually bytes commands, bytes[] inputs.

    // RE-READ DOCS SNIPPET:
    // v4Planner.finalize() returns encodedActions?
    // routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])

    // I will try to use v4Planner.actions / params if available. 
    // If not, I'll log v4Planner to inspect.

    // BUT `finalize()` usually returns string/bytes?

    // Let's assume DOCS are correct:
    // const encodedActions = v4Planner.finalize()
    // routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])

    // Wait. If finalize() encodes it, why pass actions/params? 
    // Maybe `V4_SWAP` command expects `(bytes actions, bytes[] params)`?
    // Yes. `V4_SWAP` takes the V4-specific encoded plan.

    // So:
    // routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions, v4Planner.params? or inputs?]);

    // Debugging simplified:
    // The docs example: `routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params])`

    // Encode Universal Router Call
    const { commands, inputs } = routePlanner;

    // To execute, we call UniversalRouter.execute(commands, inputs, deadline)

    const deadline = Math.floor(Date.now() / 1000) + 600;

    // Use Viem to encode execute
    // We need ABI for UniversalRouter.
    const UNIVERSAL_ROUTER_ABI = [
        {
            inputs: [
                { internalType: "bytes", name: "commands", type: "bytes" },
                { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
                { internalType: "uint256", name: "deadline", type: "uint256" },
            ],
            name: "execute",
            outputs: [],
            stateMutability: "payable",
            type: "function",
        }
    ];

    console.log("Sending Swap TX...");

    try {
        const hash = await walletClient.writeContract({
            address: UNIVERSAL_ROUTER,
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: 'execute',
            args: [commands, inputs, BigInt(deadline)],
            value: amountIn, // Send ETH value!
        });

        console.log("TX Hash:", hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("✅ Success! Block:", receipt.blockNumber);
    } catch (e) {
        console.error("❌ Failed:", e);
    }
}

main();
