/**
 * Minimal ABI for ERC-8004 Reputation Registry.
 * Source: https://github.com/erc-8004/erc-8004-contracts
 */
export const REPUTATION_REGISTRY_ABI = [
    {
        inputs: [
            { internalType: "uint256", name: "agentId", type: "uint256" },
            { internalType: "int8", name: "score", type: "int8" },
            { internalType: "string", name: "comment", type: "string" }
        ],
        name: "submitFeedback",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
        name: "getFeedbackCount",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
        name: "getAverageScore",
        outputs: [{ internalType: "int256", name: "", type: "int256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "agentId", type: "uint256" },
            { internalType: "uint256", name: "index", type: "uint256" }
        ],
        name: "getFeedback",
        outputs: [
            { internalType: "address", name: "reviewer", type: "address" },
            { internalType: "int8", name: "score", type: "int8" },
            { internalType: "string", name: "comment", type: "string" },
            { internalType: "uint256", name: "timestamp", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "agentId",
                type: "uint256"
            },
            {
                indexed: true,
                internalType: "address",
                name: "reviewer",
                type: "address"
            },
            {
                indexed: false,
                internalType: "int8",
                name: "score",
                type: "int8"
            },
            {
                indexed: false,
                internalType: "string",
                name: "comment",
                type: "string"
            }
        ],
        name: "FeedbackSubmitted",
        type: "event"
    }
] as const
