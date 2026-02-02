// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SurgeResolver
 * @notice ENS Resolver that implements CCIP-Read (EIP-3668) for offchain data
 * @dev Deploys on Sepolia. Points to your Next.js Gateway API for resolution.
 */

error OffchainLookup(
    address sender,
    string[] urls,
    bytes callData,
    bytes4 callbackFunction,
    bytes extraData
);

contract SurgeResolver {
    using ECDSA for bytes32;

    /// @notice Your Gateway URL (e.g., "https://your-app.com/api/gateway")
    string public gatewayUrl;
    
    /// @notice Address whose signature is trusted (your server's wallet)
    address public signer;
    
    /// @notice Owner address for admin functions
    address public owner;

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event GatewayUpdated(string oldUrl, string newUrl);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(string memory _gatewayUrl, address _signer) {
        gatewayUrl = _gatewayUrl;
        signer = _signer;
        owner = msg.sender;
    }

    /**
     * @notice Standard ENS resolve function
     * @dev Always reverts with OffchainLookup to trigger CCIP-Read
     * @param name The ENS name being resolved (DNS-encoded)
     * @param data The original resolver call data
     */
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        // Build the gateway URLs array
        string[] memory urls = new string[](1);
        urls[0] = gatewayUrl;

        // Encode context for the gateway (name, data, sender)
        bytes memory callData = abi.encode(name, data, msg.sender);

        // Revert with OffchainLookup - client will call gateway
        revert OffchainLookup(
            address(this),
            urls,
            callData,
            this.resolveWithProof.selector,
            data // extraData for callback
        );
    }

    /**
     * @notice Callback function after gateway response
     * @dev Verifies the signature and returns the result
     * @param response The gateway response (signature + result)
     * @param extraData Original request data (unused, for EIP compliance)
     */
    function resolveWithProof(
        bytes calldata response,
        bytes calldata extraData
    ) external view returns (bytes memory) {
        // Decode response: (signature, result)
        (bytes memory sig, bytes memory result) = abi.decode(response, (bytes, bytes));

        // Verify signature came from trusted signer
        bytes32 messageHash = keccak256(result);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(sig);
        
        require(recovered == signer, "Invalid signature");

        return result;
    }

    /**
     * @notice Implements EIP-165 interface detection
     */
    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        // IExtendedResolver interface ID
        return interfaceID == 0x9061b923;
    }

    // ============ Admin Functions ============

    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setGatewayUrl(string memory _url) external onlyOwner {
        emit GatewayUpdated(gatewayUrl, _url);
        gatewayUrl = _url;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
