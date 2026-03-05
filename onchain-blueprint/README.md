# Onchain Integration Blueprint (Solana-first, Fail-Closed)

## Purpose
This blueprint specifies the **Truth Layer** that powers:
- contract verification
- mint/freeze authority checks
- minimal supply/decimals retrieval
- optional enrichment (Metaplex metadata, indexers like Helius/Moralis)
- deterministic **fail-closed** behavior in the presence of missing or conflicting data

## Principles
1. **Fail-Closed**: unknown => risk-up, never risk-down.
2. **Evidence-backed**: anything "verified" must include evidence metadata (rpc endpoint, slot, timestamp).
3. **Deterministic**: stable sorting, stable hashing, no `Math.random()`.
4. **Depth modes**: `lite | standard | deep` to control cost/latency.

## Layering
- L0: Address Gate (format validation)
- L1: RPC Verify (minimal onchain state)
- L2: Enrichment (indexers, LP state, holders, cluster detection)

See `contracts.md` + `schemas/` for exact output shapes.
