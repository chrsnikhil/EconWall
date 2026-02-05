import { createPublicClient, http, encodeAbiParameters, parseAbiParameters, decodeErrorResult, Hex, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";

// The OffchainLookup error signature (EIP-3668)
const OFFCHAIN_LOOKUP_ABI = [
    {
        inputs: [
            { name: "sender", type: "address" },
            { name: "urls", type: "string[]" },
            { name: "callData", type: "bytes" },
            { name: "callbackFunction", type: "bytes4" },
            { name: "extraData", type: "bytes" },
        ],
        name: "OffchainLookup",
        type: "error",
    },
] as const;

// Minimal Resolver ABI
const RESOLVER_ABI = [
    {
        inputs: [
            { name: "name", type: "bytes" },
            { name: "data", type: "bytes" },
        ],
        name: "resolve",
        outputs: [{ name: "", type: "bytes" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "response", type: "bytes" },
            { name: "extraData", type: "bytes" },
        ],
        name: "resolveWithProof",
        outputs: [{ name: "", type: "bytes" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// Public client for Sepolia (where EconWall resolver lives)
const client = createPublicClient({
    chain: sepolia,
    transport: http(),
});

/**
 * Performs a CCIP-Read (EIP-3668) resolution
 * 
 * 1. Calls the contract
 * 2. Catches OffchainLookup revert
 * 3. Calls the Gateway API
 * 4. Calls the contract callback with the gateway response
 */
export async function resolveEnsWithCcip(
    resolverAddress: Hex,
    name: string,
    userAddress: Hex,
    privyUserId?: string | null
): Promise<string> {
    console.log(`Starting CCIP-Read for ${name}...`);

    // 1. Encode the initial call data (resolve(name, data))
    // For this hackathon, we're just resolving the "proxyUrl" so data is empty
    const dnsName = encodeDnsName(name);

    try {
        // This expects to REVERT with OffchainLookup
        // We use client.request (RAW JSON-RPC) to completely bypass viem's middleware.
        // This guarantees viem cannot attempt the CCIP-read automatically.
        const rawResult = await client.request({
            method: 'eth_call',
            params: [{
                to: resolverAddress,
                data: encodeFunctionData({
                    abi: RESOLVER_ABI,
                    functionName: "resolve",
                    args: [dnsName, "0x"],
                })
            }, "latest"]
        });

        // If we get here, it didn't revert (which is unexpected for this resolver)
        // But eth_call returns the result hex. If it was a revert, it usually throws depending on the RPC provider
        // or returns the revert data. 
        // Viem's transport usually throws on revert.

        return "Error: Contract did not revert (RPC returned success?)";

    } catch (err: any) {
        // 2. Decode the OffchainLookup error
        // With raw eth_call, the error structure might differ slightly.
        const errorData = err.data || err.walk?.((e: any) => e.data)?.data || err.message?.match(/0x[0-9a-fA-F]+/)?.[0];

        if (!errorData) {
            console.error("No error data found", err);
            throw new Error("Contract call failed without OffchainLookup");
        }

        try {
            const decoded = decodeErrorResult({
                abi: OFFCHAIN_LOOKUP_ABI,
                data: errorData,
            });

            if (decoded.errorName !== "OffchainLookup") {
                throw new Error(`Unexpected error: ${decoded.errorName}`);
            }

            // args is a tuple [sender, urls, callData, callbackFunction, extraData]
            // Note: contractSender is the address of the resolver contract that threw the error
            const [contractSender, urls, callData, callbackFunction, extraData] = decoded.args;
            const gatewayUrl = urls[0];

            console.log(`OffchainLookup caught! Redirecting to ${gatewayUrl}`);
            console.log("DEBUG: User Address (arg):", userAddress);
            console.log("DEBUG: Contract Address (from error):", contractSender);

            // 3. Call the Gateway API
            // We assume the gateway URL supports POST with { sender, data } (EIP-3668 standard)
            // Note: Our gateway is slightly custom for the hackathon but follows the spirit
            const response = await fetch(gatewayUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: callData,
                    sender: userAddress, // EXPLICITLY passing the user address
                    name: name, // Helper for our gateway
                    privyUserId: privyUserId // For session tracking
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Gateway request failed");
            }

            const { data: responseData, proxyUrl } = await response.json();

            // 4. Call the Callback (resolveWithProof)
            // CCIP-Read requires us to call the callback function specified in OffchainLookup
            // The callback is usually `resolveWithProof(response, extraData)`
            const callbackResult = await client.readContract({
                address: resolverAddress,
                abi: RESOLVER_ABI,
                functionName: "resolveWithProof",
                args: [responseData, extraData],
            });

            // Valid callback execution means the signature was verified!
            // Return the proxy URL that we got from the trusted gateway
            return proxyUrl || "Access Granted";

        } catch (ccipError: any) {
            console.error("CCIP-Read failed:", ccipError);
            throw ccipError;
        }
    }
}

// Helper: Encode simple DNS name (e.g. "econwall.eth") to bytes
function encodeDnsName(name: string): Hex {
    // Simplified DNS encoding for "econwall.eth" -> 0x0865636f6e77616c6c0365746800
    let res = "0x";
    const parts = name.split(".");
    for (const part of parts) {
        res += part.length.toString(16).padStart(2, "0");
        res += Buffer.from(part).toString("hex");
    }
    res += "00";
    return res as Hex;
}
