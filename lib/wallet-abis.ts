// SmartWalletFactory ABI (minimal)
export const WALLET_FACTORY_ABI = [
    {
        inputs: [{ name: "owner", type: "address" }],
        name: "getOrCreateWallet",
        outputs: [{ name: "wallet", type: "address" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [{ name: "owner", type: "address" }],
        name: "getWallet",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ name: "owner", type: "address" }],
        name: "hasWallet",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "totalWallets",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "admin",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "walletOwner", type: "address" },
            { name: "target", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" }
        ],
        name: "executeFor",
        outputs: [{ name: "", type: "bytes" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "wallet", type: "address" }
        ],
        name: "WalletCreated",
        type: "event",
    }
] as const;

// SmartWallet ABI (minimal)
export const SMART_WALLET_ABI = [
    {
        inputs: [],
        name: "owner",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ name: "token", type: "address" }],
        name: "getTokenBalance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "target", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" }
        ],
        name: "execute",
        outputs: [{ name: "", type: "bytes" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { name: "token", type: "address" },
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "approveToken",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    }
] as const;

// ERC20 ABI (minimal)
export const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    }
] as const;
