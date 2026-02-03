const { keccak256, toBytes } = require('viem');

const errors = [
    "V4SwapError()",
    "AmountOutNotSufficient()",
    "InvalidUniversalRouter()",
    "ExecutionFailed()",
    "ETHNotSent()",
    "SliceOutOfBounds()",
    "ExecutionReverted()",
    "TransactionDeadlinePassed()",
];

console.log("Searching for 0x3b99b53d...");

errors.forEach(err => {
    const hash = keccak256(toBytes(err)).slice(0, 10);
    console.log(`${hash} : ${err}`);
});
const error3 = "V4TooMuchRequested(uint128)";
const hash3 = keccak256(toBytes(error3)).slice(0, 10);
console.log(`${hash3} : ${error3}`);
