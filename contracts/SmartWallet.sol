// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SmartWallet
 * @notice Minimal smart wallet for EconWall users
 * @dev Each user gets one wallet, controlled by their MetaMask address OR server
 */
contract SmartWallet {
    address public owner;
    address public factory;
    bool public initialized;

    event Executed(address indexed target, uint256 value, bytes data);
    event Received(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner || msg.sender == factory, "Not authorized");
        _;
    }

    /**
     * @notice Initialize wallet (called by factory)
     * @param _owner The MetaMask address that owns this wallet
     */
    function initialize(address _owner) external {
        require(!initialized, "Already initialized");
        owner = _owner;
        factory = msg.sender;
        initialized = true;
    }

    /**
     * @notice Execute arbitrary call (for swaps, approvals, etc.)
     * @param target Contract to call
     * @param value ETH to send
     * @param data Calldata
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
        return result;
    }

    /**
     * @notice Batch execute multiple calls
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwner returns (bytes[] memory results) {
        require(
            targets.length == values.length && values.length == datas.length,
            "Length mismatch"
        );
        
        results = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);
            require(success, "Batch execution failed");
            results[i] = result;
            emit Executed(targets[i], values[i], datas[i]);
        }
    }

    /**
     * @notice Approve token spending (convenience function)
     */
    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).approve(spender, amount);
    }

    /**
     * @notice Withdraw ETH to owner
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    /**
     * @notice Withdraw ERC20 tokens to owner
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    /**
     * @notice Get token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
