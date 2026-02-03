const { keccak256, toBytes } = require('viem');

const errors = [
    "PriceLimitAlreadyExceeded(uint160,uint160)",
    "PriceLimitExceeded(uint160)",
    "V4TooMuchRequested(uint128)",
];

console.log("Searching for 0x7c9c6e8f...");

errors.forEach(err => {
    const hash = keccak256(toBytes(err)).slice(0, 10);
    console.log(`${hash} : ${err}`);
});

console.log("Searching for 0x7c9c6e8f...");

errors.forEach(err => {
    const hash = keccak256(toBytes(err)).slice(0, 10);
    console.log(`${hash} : ${err}`);
    if (hash === '0x7c9c6e8f') {
        console.log(`\n🎉 FOUND IT: ${err}`);
    }
});
