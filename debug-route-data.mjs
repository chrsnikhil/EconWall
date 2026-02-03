import { V4Planner, Actions } from "@uniswap/v4-sdk";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";
import { Ether, Token } from "@uniswap/sdk-core";
import { parseEther } from "viem";

const CHAIN_ID = 1301;
const EWT_ADDRESS = "0xC5a5C42992dEcbae36851359345FE25997F5C42d"; // Example address
const ETH_TOKEN = Ether.onChain(CHAIN_ID);
const EWT_TOKEN = new Token(CHAIN_ID, EWT_ADDRESS, 18, 'EWT', 'EconWall Token');

const poolKey = {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: EWT_ADDRESS,
    fee: 3000,
    tickSpacing: 100,
    hooks: "0x0000000000000000000000000000000000000000",
};

const v4Planner = new V4Planner();
const amountWei = parseEther("0.001");

const swapConfig = {
    poolKey,
    zeroForOne: true,
    amountIn: amountWei.toString(),
    amountOutMinimum: "0",
    hookData: "0x",
};

v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);

// Settle ETH
v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, amountWei.toString()]);
// Take EWT
v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, "0"]);

const routePlanner = new RoutePlanner();
routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

const { commands, inputs } = routePlanner;

console.log("Commands:", commands);
console.log("Inputs Length:", inputs.length);
console.log("Input[0]:", inputs[0]);
