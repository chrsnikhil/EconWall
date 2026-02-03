import { keccak256, toBytes } from 'viem';

// Common Uniswap V4 & Universal Router Errors
const errors = [
    // Pool Manager
    "PoolNotInitialized()",
    "LiquidityUnassigned()",
    "TickSpacingTooSmall()",
    "CurrenciesInitialized()",
    "PriceLimitAlreadyExceeded(int256,int256)",
    "CurrencyNotSettled()",
    "ManagerLocked()",

    // Router / V4Router
    "V4SwapError()",
    "V4TooMuchRequested(uint128)",
    "V4TooLittleReceived(uint128)", // Common!
    "TransactionDeadlinePassed()",
    "AmountOutNotSufficient()",
    "CallbackFailed()",
    "InvalidCurrency()",
    "InvalidUniversalRouter()",
    "ExecutionFailed(uint256,bytes)",
    "ETHNotSent()",
    "SliceOutOfBounds()",
    "InvalidPath()",
    "V4InvalidPath()",
    "InvalidReserves()",
    "Unauthorized()",

    // Dispatcher/Commander
    "InvalidCommandType(uint256)",
    "CommandFailed(uint256)",
    "ExecutionReverted()",

    // Permit2
    "InvalidNonce()",
    "SignatureExpired(uint256)",
    "InsufficientAllowance()",
];

console.log("Decoding 0x7c9c6e8f...");

errors.forEach(err => {
    const hash = keccak256(toBytes(err)).slice(0, 10);
    if (hash === '0x7c9c6e8f') {
        console.log(`MATCH FOUND: ${err}`);
    } else {
        // console.log(`${hash} : ${err}`);
    }
});
