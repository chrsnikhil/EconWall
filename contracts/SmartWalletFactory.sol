// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./SmartWallet.sol";

/**
 * @title SmartWalletFactory
 * @notice Factory for deploying minimal proxy wallets (EIP-1167)
 * @dev One wallet per MetaMask address, gas-efficient clones
 */
contract SmartWalletFactory {
    using Clones for address;

    address public immutable walletImplementation;
    address public admin;

    // Mapping: MetaMask address => Smart Wallet address
    mapping(address => address) public wallets;
    
    // All created wallets
    address[] public allWallets;

    event WalletCreated(address indexed owner, address indexed wallet);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        // Deploy implementation contract
        walletImplementation = address(new SmartWallet());
        admin = msg.sender;
    }

    /**
     * @notice Create or get wallet for a MetaMask address
     * @param owner The user's MetaMask address
     * @return wallet The smart wallet address
     */
    function getOrCreateWallet(address owner) external returns (address wallet) {
        // Return existing wallet if exists
        if (wallets[owner] != address(0)) {
            return wallets[owner];
        }

        // Deploy new minimal proxy
        wallet = walletImplementation.clone();
        SmartWallet(payable(wallet)).initialize(owner);

        // Store mapping
        wallets[owner] = wallet;
        allWallets.push(wallet);

        emit WalletCreated(owner, wallet);
    }

    /**
     * @notice Get wallet for address (view only)
     */
    function getWallet(address owner) external view returns (address) {
        return wallets[owner];
    }

    /**
     * @notice Check if wallet exists
     */
    function hasWallet(address owner) external view returns (bool) {
        return wallets[owner] != address(0);
    }

    /**
     * @notice Get total wallets created
     */
    function totalWallets() external view returns (uint256) {
        return allWallets.length;
    }

    /**
     * @notice Execute on behalf of a wallet (admin only - for gasless transactions)
     * @param walletOwner The owner address whose wallet to use
     * @param target Contract to call
     * @param value ETH to send
     * @param data Calldata
     */
    function executeFor(
        address walletOwner,
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyAdmin returns (bytes memory) {
        address wallet = wallets[walletOwner];
        require(wallet != address(0), "Wallet not found");
        return SmartWallet(payable(wallet)).execute(target, value, data);
    }

    /**
     * @notice Change admin
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }
}
