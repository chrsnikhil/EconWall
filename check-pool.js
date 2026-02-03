const { createPublicClient, http, toHex, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
require('dotenv').config({ path: '.env.local' });

const unichainSepolia = {
    id: 1301,
    name: 'Unichain Sepolia',
    network: 'unichain-sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://sepolia.unichain.org'] },
        public: { http: ['https://sepolia.unichain.org'] },
    },
};

const POOL_MANAGER = "0x00b036b58a818b1bc34d502d3fe730db729e62ac";
// Make sure this matches EWT in .env.local
const EWT_ADDRESS = "0xC5a2D9afeE6E0Ae1E33AE0E652941F24e95D0C09";
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

if (!EWT_ADDRESS) {
    console.error("EWT_ADDRESS missing");
    process.exit(1);
}

const POOL_MANAGER_ABI = [
    {
        name: "getSlot0",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "id", type: "bytes32" }],
        outputs: [
            { name: "sqrtPriceX96", type: "uint160" },
            { name: "tick", type: "int24" },
            { name: "protocolFee", type: "uint24" },
            { name: "lpFee", type: "uint24" }
        ]
    }
];

async function main() {
    console.log("Checking Pool State...");
    console.log("EWT:", EWT_ADDRESS);

    const client = createPublicClient({
        chain: unichainSepolia,
        transport: http(),
    });

    const currency0 = NATIVE_ETH;
    const currency1 = EWT_ADDRESS;
    const fee = 3000;
    const tickSpacing = 60;
    const hooks = NATIVE_ETH;

    // Calculate Pool ID
    const poolKey = { currency0, currency1, fee, tickSpacing, hooks };
    console.log("Pool Key:", poolKey);

    // Compute ID: keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
    const encoded = encodeAbiParameters(
        parseAbiParameters('address, address, uint24, int24, address'),
        [currency0, currency1, fee, tickSpacing, hooks]
    );
    const id = keccak256(encoded);
    console.log("Pool ID:", id);

    try {
        const slot0 = await client.readContract({
            address: POOL_MANAGER,
            abi: POOL_MANAGER_ABI,
            functionName: "getSlot0",
            args: [id]
        });

        console.log("Slot0:", slot0);
        console.log("sqrtPriceX96:", slot0[0].toString());
        console.log("tick:", slot0[1]);

        if (slot0[0] === 0n) {
            console.log("⚠️ Pool is UNINITIALIZED (Price is 0)!");
        } else {
            console.log("✅ Pool is initialized.");
        }

    } catch (e) {
        console.error("Error reading slot0:", e);
    }
}

main();
