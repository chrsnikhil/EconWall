const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying SmartWalletFactory to Unichain Sepolia...");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    // Deploy Factory (which also deploys the implementation)
    const Factory = await ethers.getContractFactory("SmartWalletFactory");
    const factory = await Factory.deploy();

    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    const implAddress = await factory.walletImplementation();

    console.log("\n=== Deployment Complete ===");
    console.log("SmartWalletFactory:", factoryAddress);
    console.log("SmartWallet Implementation:", implAddress);
    console.log("\nAdd to .env.local:");
    console.log(`NEXT_PUBLIC_WALLET_FACTORY_ADDRESS=${factoryAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
