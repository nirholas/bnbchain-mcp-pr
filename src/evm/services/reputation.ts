import { type Hex } from "viem"

import { resolveChainId } from "../chains.js"
import { getERC8004Registries } from "../agentsRegistry.js"
import { getPublicClient } from "./clients.js"
import { readContract, writeContract } from "./contracts.js"
import { REPUTATION_REGISTRY_ABI } from "./abi/reputationRegistry.js"

function formatPrivateKey(privateKey: string | Hex): Hex {
  return typeof privateKey === "string" && !privateKey.startsWith("0x")
    ? (`0x${privateKey}` as Hex)
    : (privateKey as Hex)
}

/**
 * Submit reputation feedback for an ERC-8004 agent.
 * @param score int8 range: -128 to 127 (positive = good, negative = bad)
 */
export async function submitReputation(
  privateKey: string | Hex,
  agentId: bigint | number,
  score: number,
  comment: string,
  network: string | number = "bsc"
): Promise<{ txHash: string }> {
  const key = formatPrivateKey(privateKey)
  const chainId = resolveChainId(network)
  const { reputationRegistry } = getERC8004Registries(chainId)

  const txHash = await writeContract(
    key,
    {
      address: reputationRegistry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "submitFeedback",
      args: [BigInt(agentId), score, comment]
    },
    network
  )

  return { txHash }
}

/**
 * Get the on-chain reputation summary for an ERC-8004 agent.
 */
export async function getReputation(
  agentId: bigint | number,
  network: string | number = "bsc",
  limit = 20
): Promise<{
  totalFeedback: number
  averageScore: number
  recentFeedback: Array<{
    reviewer: string
    score: number
    comment: string
    timestamp: number
  }>
}> {
  const chainId = resolveChainId(network)
  const { reputationRegistry } = getERC8004Registries(chainId)
  const id = BigInt(agentId)

  const [feedbackCount, averageScore] = await Promise.all([
    readContract(
      {
        address: reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getFeedbackCount",
        args: [id]
      },
      network
    ).catch(() => BigInt(0)),
    readContract(
      {
        address: reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getAverageScore",
        args: [id]
      },
      network
    ).catch(() => BigInt(0))
  ])

  const count = Number(feedbackCount as bigint)
  const entries: Array<{
    reviewer: string
    score: number
    comment: string
    timestamp: number
  }> = []

  // Fetch individual feedback entries (most recent first)
  const start = Math.max(0, count - limit)
  for (let i = count - 1; i >= start; i--) {
    try {
      const result = (await readContract(
        {
          address: reputationRegistry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "getFeedback",
          args: [id, BigInt(i)]
        },
        network
      )) as [string, number, string, bigint]

      entries.push({
        reviewer: result[0],
        score: Number(result[1]),
        comment: result[2],
        timestamp: Number(result[3])
      })
    } catch {
      // Skip inaccessible entries
    }
  }

  return {
    totalFeedback: count,
    averageScore: Number(averageScore as bigint),
    recentFeedback: entries
  }
}
