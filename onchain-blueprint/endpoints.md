# Suggested Endpoints (Solana)

## RPC (Core)
- Primary RPC endpoint (paid preferred)
- Secondary RPC endpoint (fallback)

## Optional Enrichment
- Helius (enhanced tx & accounts)
- Moralis (wallet/portfolio + holders if needed)

## Rate limiting
- Always implement: retry budget, backoff, circuit-breaker
- Cache all L1 results with TTL (e.g. 60s–300s) to reduce blast radius

## Data minimization
For `lite` depth, only fetch:
- Mint account info
- Supply + decimals
- Mint authority option
- Freeze authority option
