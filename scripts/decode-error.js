const { keccak256, toBytes } = require('viem');

function getSelector(sig) {
    return keccak256(toBytes(sig)).slice(0, 10); // 0x + 4 bytes (8 chars)
}

// Common Errors in Uniswap V4 / Universal Router
const signatures = [
    'TransactionDeadlinePassed(uint256,uint256)',
    'TransactionDeadlinePassed(uint256)',
    'DeadlinePassed(uint256)',
    'Expired(uint256)',
    'V4TooLittleReceived(uint256,uint256)',
    'V4TooLittleReceived()',
    'OutputLess(uint256,uint256)',
    'ExecutionReverted()',
    'CallbackFailed()',
    'PoolNotInitialized()',
    'ExecutionFailed(uint256,bytes)',
    'SliceOutOfBounds()',
    'InvalidPool()',
    'ETHNotAccepted()',
    'PriceSlippage(uint256)',
    'V2TransferFailed()',
    'WrapEthFailed()',
    'UnsafeCast()',
    // V4 Specific
    'PoolAlreadyInitialized()',
    'LiquidityMathError()',
    'TickMathError()',
    'CurrencyNotSettled()',
    'ManagerLocked()',
    'SwapAmountCannotBeZero()',
    'InvalidFee()',
    'InvalidTickSpacing()',
    'HooksNotSorted()',
    'InvalidHookResponse()',
    'DeltaNotPositive(int256)',
    'BalanceNotSettled()',
];

const target = '0x7c9c6e8f';

console.log(`Looking for selector: ${target}`);

let found = false;
signatures.forEach(sig => {
    const errorSelector = getSelector(sig);
    console.log(`${sig} -> ${errorSelector}`);

    if (errorSelector === target) {
        console.log(`\n✅ MATCH FOUND (Error): ${sig}`);
        found = true;
    }
});

if (!found) {
    console.log("\n❌ No match found in common list.");
}
