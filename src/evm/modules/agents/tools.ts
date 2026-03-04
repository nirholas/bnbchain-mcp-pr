import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

export function registerAgentsTools(server: McpServer) {
  // ─── Identity Tools (existing) ───

  server.tool(
    "register_erc8004_agent",
    "Register an agent on the ERC-8004 Identity Registry. Mints an on-chain agent identity (NFT) and returns the agent ID. Use BSC or BSC Testnet; the agentURI should point to a JSON metadata file (AgentURI format) with name, description, image, and services (e.g. MCP endpoint).",
    {
      privateKey: privateKeyParam,
      agentURI: z
        .string()
        .describe(
          "URI of the agent metadata (e.g. ipfs://..., https://..., or data:application/json,...). Should follow ERC-8004 registration format with type, name, description, image, and services."
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, agentURI, network }) => {
      try {
        const result = await services.registerAgent(
          privateKey,
          agentURI,
          network
        )
        return mcpToolRes.success({
          agentId: result.agentId.toString(),
          txHash: result.txHash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "registering ERC-8004 agent")
      }
    }
  )

  server.tool(
    "set_erc8004_agent_uri",
    "Update the metadata URI for an existing ERC-8004 agent. Caller must be the owner of the agent NFT.",
    {
      privateKey: privateKeyParam,
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID from the Identity Registry)"),
      newURI: z
        .string()
        .describe("New URI for the agent metadata (AgentURI format)"),
      network: defaultNetworkParam
    },
    async ({ privateKey, agentId, newURI, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.setAgentURI(
          privateKey,
          id,
          newURI,
          network
        )
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          agentId: agentId.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "setting ERC-8004 agent URI")
      }
    }
  )

  server.tool(
    "get_erc8004_agent",
    "Get agent info from the ERC-8004 Identity Registry: owner address and tokenURI (metadata URI).",
    {
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      network: defaultNetworkParam
    },
    async ({ agentId, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.getAgent(id, network)
        return mcpToolRes.success({
          agentId: agentId.toString(),
          owner: result.owner,
          tokenURI: result.tokenURI,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC-8004 agent")
      }
    }
  )

  server.tool(
    "get_erc8004_agent_wallet",
    "Get the verified payment wallet address for an ERC-8004 agent (for x402 / agent payments). Set on-chain via setAgentWallet; defaults to owner on registration.",
    {
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      network: defaultNetworkParam
    },
    async ({ agentId, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const wallet = await services.getAgentWallet(id, network)
        return mcpToolRes.success({
          agentId: agentId.toString(),
          agentWallet: wallet,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC-8004 agent wallet")
      }
    }
  )

  // ─── Reputation Tools ───

  server.tool(
    "submit_erc8004_reputation",
    "Submit reputation feedback for an ERC-8004 agent on the Reputation Registry. Score is int8 (-128 to 127, positive = good). Feedback is stored on-chain. Requires a private key to sign the transaction.",
    {
      privateKey: privateKeyParam,
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      score: z
        .number()
        .int()
        .min(-128)
        .max(127)
        .describe(
          "Reputation score (-128 to 127). Positive = good, negative = bad."
        ),
      comment: z
        .string()
        .describe("Feedback comment explaining the score"),
      network: defaultNetworkParam
    },
    async ({ privateKey, agentId, score, comment, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.submitReputation(
          privateKey,
          id,
          score,
          comment,
          network
        )
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          agentId: agentId.toString(),
          score,
          comment,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "submitting ERC-8004 reputation")
      }
    }
  )

  server.tool(
    "get_erc8004_reputation",
    "Get the on-chain reputation for an ERC-8004 agent. Returns total feedback count, average score, and recent feedback entries with reviewer address, score, comment, and timestamp.",
    {
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Max feedback entries to return (default: 20)"),
      network: defaultNetworkParam
    },
    async ({ agentId, limit, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.getReputation(id, network, limit)
        return mcpToolRes.success({
          agentId: agentId.toString(),
          ...result,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC-8004 reputation")
      }
    }
  )

  // ─── Metadata Tools ───

  server.tool(
    "set_erc8004_metadata",
    'Set on-chain key-value metadata for an ERC-8004 agent. Common keys: "version", "a2a.endpoint", "mcp.endpoint", "did", "ens", "x402.enabled". Only the agent owner can set metadata.',
    {
      privateKey: privateKeyParam,
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      key: z
        .string()
        .describe(
          'Metadata key (e.g., "version", "a2a.endpoint", "mcp.endpoint", "did", "ens")'
        ),
      value: z
        .string()
        .describe("Metadata value (will be UTF-8 encoded to bytes on-chain)"),
      network: defaultNetworkParam
    },
    async ({ privateKey, agentId, key, value, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.setAgentMetadata(
          privateKey,
          id,
          key,
          value,
          network
        )
        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          agentId: agentId.toString(),
          key,
          value,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "setting ERC-8004 metadata")
      }
    }
  )

  server.tool(
    "get_erc8004_metadata",
    "Read a single on-chain metadata value for an ERC-8004 agent by key. Returns the decoded UTF-8 value and raw hex bytes. Read-only.",
    {
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      key: z
        .string()
        .describe(
          'Metadata key to look up (e.g., "version", "a2a.endpoint")'
        ),
      network: defaultNetworkParam
    },
    async ({ agentId, key, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.getAgentMetadata(id, key, network)
        return mcpToolRes.success({
          agentId: agentId.toString(),
          key,
          ...result,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC-8004 metadata")
      }
    }
  )

  server.tool(
    "batch_get_erc8004_metadata",
    "Read multiple on-chain metadata values for an ERC-8004 agent in one call. Provide a list of keys to look up. Returns a map of key to {value, rawBytes}.",
    {
      agentId: z
        .union([z.string(), z.number()])
        .describe("The ERC-8004 agent ID (token ID)"),
      keys: z
        .array(z.string())
        .describe(
          'List of metadata keys to look up (e.g., ["version", "mcp.endpoint", "a2a.endpoint"])'
        ),
      network: defaultNetworkParam
    },
    async ({ agentId, keys, network }) => {
      try {
        const id =
          typeof agentId === "string" ? BigInt(agentId) : BigInt(agentId)
        const result = await services.batchGetAgentMetadata(
          id,
          keys,
          network
        )
        return mcpToolRes.success({
          agentId: agentId.toString(),
          metadata: result,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch getting ERC-8004 metadata")
      }
    }
  )

  // ─── Discovery Tools ───

  server.tool(
    "list_erc8004_agents",
    "List all ERC-8004 agents owned by a specific address. Scans Transfer events and verifies current ownership.",
    {
      address: z
        .string()
        .describe("Owner wallet address (0x...)"),
      network: defaultNetworkParam
    },
    async ({ address, network }) => {
      try {
        const result = await services.listAgentsByOwner(
          address as `0x${string}`,
          network
        )
        return mcpToolRes.success({
          address,
          ...result,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "listing ERC-8004 agents")
      }
    }
  )

  server.tool(
    "get_erc8004_agent_count",
    "Get the total number of registered ERC-8004 agents on a given chain. Uses binary search on sequential token IDs.",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const count = await services.getAgentCount(network)
        return mcpToolRes.success({ count, network })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC-8004 agent count")
      }
    }
  )

  server.tool(
    "search_erc8004_agents",
    "Search registered ERC-8004 agents by name, service type, or metadata content. Scans on-chain Registered events and optionally filters by a query string.",
    {
      query: z
        .string()
        .optional()
        .describe(
          "Search query to match against agent URIs and decoded metadata"
        ),
      fromBlock: z
        .number()
        .optional()
        .default(0)
        .describe("Starting block number (default: 0)"),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe("Max results to return (default: 50)"),
      network: defaultNetworkParam
    },
    async ({ query, fromBlock, limit, network }) => {
      try {
        const results = await services.searchAgents(
          network,
          query,
          BigInt(fromBlock ?? 0),
          limit
        )
        return mcpToolRes.success({
          query: query ?? null,
          count: results.length,
          results,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "searching ERC-8004 agents")
      }
    }
  )
}
