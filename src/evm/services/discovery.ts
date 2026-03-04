import { decodeEventLog } from "viem"

import { resolveChainId } from "../chains.js"
import { getERC8004Registries } from "../agentsRegistry.js"
import { getPublicClient } from "./clients.js"
import { readContract, getLogs } from "./contracts.js"
import { IDENTITY_REGISTRY_ABI } from "./abi/identityRegistry.js"

/**
 * List all agents owned by an address on a given chain.
 * Scans Transfer events and verifies current ownership.
 */
export async function listAgentsByOwner(
  address: `0x${string}`,
  network: string | number = "bsc"
): Promise<{
  count: number
  agents: Array<{ agentId: string; tokenURI: string | null }>
}> {
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)
  const client = getPublicClient(network)

  // Get Transfer events to this address
  const logs = await client.getLogs({
    address: identityRegistry,
    event: {
      type: "event",
      name: "Transfer",
      inputs: [
        { indexed: true, name: "from", type: "address" },
        { indexed: true, name: "to", type: "address" },
        { indexed: true, name: "tokenId", type: "uint256" }
      ]
    },
    args: { to: address },
    fromBlock: 0n,
    toBlock: "latest"
  })

  const agents: Array<{ agentId: string; tokenURI: string | null }> = []

  for (const log of logs) {
    const agentId = (log.args as { tokenId: bigint }).tokenId

    // Verify current ownership
    try {
      const currentOwner = (await readContract(
        {
          address: identityRegistry,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [agentId]
        },
        network
      )) as string

      if (currentOwner.toLowerCase() === address.toLowerCase()) {
        let tokenURI: string | null = null
        try {
          tokenURI = (await readContract(
            {
              address: identityRegistry,
              abi: IDENTITY_REGISTRY_ABI,
              functionName: "tokenURI",
              args: [agentId]
            },
            network
          )) as string
        } catch {
          // Token may not have a URI set
        }

        agents.push({ agentId: agentId.toString(), tokenURI })
      }
    } catch {
      // Token was transferred away or burned
    }
  }

  return { count: agents.length, agents }
}

/**
 * Get the approximate total number of registered ERC-8004 agents.
 * Uses binary search on sequential token IDs.
 */
export async function getAgentCount(
  network: string | number = "bsc"
): Promise<number> {
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)

  // Check if token 1 exists
  try {
    await readContract(
      {
        address: identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [1n]
      },
      network
    )
  } catch {
    return 0
  }

  let low = 1
  let high = 100_000
  let count = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    try {
      await readContract(
        {
          address: identityRegistry,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [BigInt(mid)]
        },
        network
      )
      count = mid
      low = mid + 1
    } catch {
      high = mid - 1
    }
  }

  return count
}

/**
 * Search registered ERC-8004 agents by scanning Registered events.
 * Optionally filters by a query string against URIs and decoded metadata.
 */
export async function searchAgents(
  network: string | number = "bsc",
  query?: string,
  fromBlock = 0n,
  limit = 50
): Promise<
  Array<{
    agentId: string
    owner: string
    uri: string
    blockNumber: number
  }>
> {
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)
  const client = getPublicClient(network)

  const logs = await client.getLogs({
    address: identityRegistry,
    event: {
      type: "event",
      name: "Registered",
      inputs: [
        { indexed: true, name: "agentId", type: "uint256" },
        { indexed: false, name: "agentURI", type: "string" },
        { indexed: true, name: "owner", type: "address" }
      ]
    },
    fromBlock,
    toBlock: "latest"
  })

  const results: Array<{
    agentId: string
    owner: string
    uri: string
    blockNumber: number
  }> = []

  for (const log of logs) {
    if (results.length >= limit) break

    const args = log.args as {
      agentId: bigint
      agentURI: string
      owner: string
    }

    // Filter by query if provided
    if (query) {
      const q = query.toLowerCase()
      const matchURI = args.agentURI.toLowerCase().includes(q)

      // Try to decode and search metadata for base64 data URIs
      let matchMeta = false
      if (args.agentURI.startsWith("data:application/json;base64,")) {
        try {
          const base64 = args.agentURI.replace(
            "data:application/json;base64,",
            ""
          )
          const json = atob(base64)
          matchMeta = json.toLowerCase().includes(q)
        } catch {
          // Not decodable, skip
        }
      }

      if (!matchURI && !matchMeta) continue
    }

    results.push({
      agentId: args.agentId.toString(),
      owner: args.owner,
      uri: args.agentURI,
      blockNumber: Number(log.blockNumber)
    })
  }

  return results
}
