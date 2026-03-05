# Contracts & Interfaces (Blueprint)

## TruthState
- `status`: `VERIFIED | UNVERIFIED | DEGRADED`
- `confidence`: 0..1
- `reasons`: string[]
- `evidence`: array of evidence objects
- `fields`: typed onchain fields (nullable)

## Evidence
- `source`: `solana_rpc | helius | moralis | dexscreener | dexp` (string enum in your code)
- `endpoint`: string (if applicable)
- `slot`: number|null
- `timestamp`: ISO8601
- `signature`: string|null
- `notes`: string|null

## OnchainPipelineInput
- `chain`: `solana | evm`
- `contract_address`
- `requestedDepth`: `lite | standard | deep`
- `timeoutsMs`: per-adapter overrides
- `cachePolicy`: `use_cache | bypass_cache`

## OnchainPipelineOutput
- `truth_state`
- `token_metadata` (optional)
- `token_security`
- `holder_distribution` (optional)
- `lp_state` (optional)
- `latency_ms`
- `sources_used`

## Fail-Closed Rules (hard)
1) invalid CA => `UNVERIFIED` + `INVALID_CONTRACT_FORMAT` flag
2) RPC timeout => `DEGRADED` + `RPC_TIMEOUT`
3) missing mint fields => null + reason
4) conflicting evidence => `UNVERIFIED` + `DISCREPANCY_DETECTED`
