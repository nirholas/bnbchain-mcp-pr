import { type Hex, toHex, fromHex } from "viem"

import { resolveChainId } from "../chains.js"
import { getERC8004Registries } from "../agentsRegistry.js"
import { readContract, writeContract } from "./contracts.js"
import { IDENTITY_REGISTRY_ABI } from "./abi/identityRegistry.js"

function formatPrivateKey(privateKey: string | Hex): Hex {
  return typeof privateKey === "string" && !privateKey.startsWith("0x")
    ? (`0x${privateKey}` as Hex)
    : (privateKey as Hex)
}

/**
 * Set on-chain key-value metadata for an ERC-8004 agent.
 */
export async function setAgentMetadata(
  privateKey: string | Hex,
  agentId: bigint | number,
  key: string,
  value: string,
  network: string | number = "bsc"
): Promise<{ txHash: string }> {
  const pk = formatPrivateKey(privateKey)
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)

  const valueBytes = toHex(new TextEncoder().encode(value))

  const txHash = await writeContract(
    pk,
    {
      address: identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "setMetadata",
      args: [BigInt(agentId), key, valueBytes]
    },
    network
  )

  return { txHash }
}

/**
 * Get a single on-chain metadata value for an ERC-8004 agent.
 */
export async function getAgentMetadata(
  agentId: bigint | number,
  key: string,
  network: string | number = "bsc"
): Promise<{ value: string; rawBytes: string }> {
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)

  const raw = (await readContract(
    {
      address: identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getMetadata",
      args: [BigInt(agentId), key]
    },
    network
  )) as `0x${string}`

  let value: string
  try {
    value = fromHex(raw, "string")
  } catch {
    value = raw
  }

  return { value, rawBytes: raw }
}

/**
 * Get multiple on-chain metadata values for an ERC-8004 agent.
 */
export async function batchGetAgentMetadata(
  agentId: bigint | number,
  keys: string[],
  network: string | number = "bsc"
): Promise<Record<string, { value: string; rawBytes: string }>> {
  const chainId = resolveChainId(network)
  const { identityRegistry } = getERC8004Registries(chainId)
  const id = BigInt(agentId)

  const results: Record<string, { value: string; rawBytes: string }> = {}

  await Promise.all(
    keys.map(async (key) => {
      try {
        const raw = (await readContract(
          {
            address: identityRegistry,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: "getMetadata",
            args: [id, key]
          },
          network
        )) as `0x${string}`

        let value: string
        try {
          value = fromHex(raw, "string")
        } catch {
          value = raw
        }
        results[key] = { value, rawBytes: raw }
      } catch {
        results[key] = { value: "", rawBytes: "0x" }
      }
    })
  )

  return results
}
