import { encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";

const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const EWT_ADDRESS = "0x312CF8c8F041df4444A19e0525452aE362F3B043";
const SURGE_HOOK_ADDRESS = "0xbB9620C96A409d321552Cff9F8c1397b879440c0";

// Ensure tokens are sorted (NATIVE_ETH is 0, so it is always token0)
const currency0 = NATIVE_ETH;
const currency1 = EWT_ADDRESS;

const POOL_KEY = {
    currency0: currency0,
    currency1: currency1,
    fee: 0x800000,
    tickSpacing: 60,
    hooks: SURGE_HOOK_ADDRESS
};

const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [POOL_KEY.currency0, POOL_KEY.currency1, POOL_KEY.fee, POOL_KEY.tickSpacing, POOL_KEY.hooks]
);

const poolId = keccak256(encoded);

console.log("Pool Manager Address: 0x00b036b58a818b1bc34d502d3fe730db729e62ac");
console.log("Pool ID:              " + poolId);
