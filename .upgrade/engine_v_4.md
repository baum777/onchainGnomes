# ENGINE v4.5 — FULL SPEC
## MCI + BCI Intelligence Architecture
Version: 1.0  
Date: 03 March 2026  
Status: Production-Ready  

---

# 1. OVERVIEW

Engine v4.5 integrates two parallel Moralis-based intelligence metrics:

• **MCI (Moralis Composite Intelligence)** → Holder & Behavioral Quality Score  
• **BCI (BundleCluster Intelligence)** → Coordinated Manipulation & Cluster Score  

Both are calculated per token and embedded into Structural and Risk layers.

---

# 2. MCI — MORALIS COMPOSITE INTELLIGENCE

## 2.1 Purpose
Quantifies holder quality, bot exposure, sniper activity and distribution health.
Focus: "Who holds and how organic is ownership?"

## 2.2 Formula

MCI =
0.25 × holder_stability
+ 0.20 × bot_suspicion_inverse
+ 0.20 × sniper_risk_score
+ 0.15 × holder_growth_velocity
+ 0.10 × supply_distribution_index
+ 0.10 × moralis_token_score

Range: 0–100

## 2.3 Sub-Metrics

### holder_stability
100 − abs(change_1h_percent)

### bot_suspicion_inverse
100 − bot_suspicion_proxy

### sniper_risk_score
Normalized early sniper count (0–100)

### holder_growth_velocity
Δholders_1h normalized to historical mean

### supply_distribution_index
100 − (top10_supply_percent × 2)

### moralis_token_score
Direct Moralis token quality score (0–100)

## 2.4 Interpretation

> 75 = strong organic structure  
50–75 = neutral  
<50 = elevated manipulation risk

## 2.5 Engine Integration

Structural_score += MCI × 0.35  
manipulation_weight += 0.15 if MCI < 45

Fallback: 50 (missing key)

---

# 3. BCI — BUNDLECLUSTER INTELLIGENCE

## 3.1 Purpose
Detects coordinated atomic manipulation via bundles, wallet clusters and timing anomalies.
Focus: "How coordinated was the buying behavior?"

## 3.2 Formula

BCI =
0.35 × bundle_clean_score
+ 0.35 × cluster_diversity_index
+ 0.20 × smart_money_cluster_score
+ 0.10 × (100 − timing_anomaly_score)

Range: 0–100

## 3.3 Sub-Metrics

### bundle_risk_score
(bundle_count / total_launch_tx) × 80 + launch_in_bundle_flag × 20

bundle_clean_score = 100 − bundle_risk_score

### cluster_diversity_index
100 − (max_cluster_size / totalHolders × 100)

### smart_money_cluster_score
min(100, smart_money_wallets_in_top20 × 13.75)

### timing_anomaly_score
(timing_anomalies / total_launch_tx × 1000) × 2.5 (capped 100)

## 3.4 Flags

bundle_launch_detected → bundle_risk_score > 50  
sybil_cluster_risk → cluster_diversity_index < 60  
coordinated_smart_money → smart_money_cluster_score > 70  
timing_pump_pattern → timing_anomaly_score > 60

## 3.5 Engine Integration

Structural_score += BCI × 0.25  
manipulation_weight += 0.20 if BCI < 45

Fallback: 45

---

# 4. MCI vs BCI — COMPARISON MATRIX

| Dimension | MCI | BCI |
|------------|------|------|
| Primary Focus | Holder health | Transaction coordination |
| Time Horizon | 1h–Lifetime | Launch + 24h |
| Complexity | Medium | High |
| Launch Detection | Moderate | Very Strong |
| Long-Term Reliability | Strong | Moderate |
| Risk Boost Power | +0.15 | +0.20 |

---

# 5. HYBRID INTELLIGENCE SCORE

Hybrid_Intelligence = 0.55 × MCI + 0.45 × BCI

Purpose:
Unified structural authenticity measure.

Interpretation:
>80 = highly organic
65–80 = mostly organic
50–65 = mixed structure
<50 = elevated manipulation probability

---

# 6. GLOBAL RISK MODEL (PHASE 2)

GlobalRisk =
0.40 LiquidityRisk
+ 0.25 SocialManipulation
+ 0.20 MomentumExhaustion
+ 0.15 StructuralWeakness

StructuralWeakness incorporates:
+ MCI contribution
+ BCI contribution

Manipulation weight capped at 0.35 total additive impact.

---

# 7. EDGE CASE HANDLING

<30 tokens → Abort execution  
Missing Moralis key → MCI=50, BCI=45  
Missing tx history → sub-scores=50 neutral  
No pairAddress → BCI=45  
Large holder base (>100k) → cluster penalty damped

---

# 8. OUTPUT CONTRACT

Each token must output:

- MCI
- BCI
- Hybrid_Intelligence
- Sub-metrics (all)
- Flags
- Structural Score
- Risk Breakdown

Report sections:
A — Data Quality  
B — Risk Decomposition  
C — Aggregates  
D — Structural Top 10  
E — Fragile Top 10  
F — Organic Summary

---

# 9. ARCHITECTURE LAYERS

Layer 1 — Market Data  
Layer 2 — Cross-Source Validation  
Layer 3 — Onchain Intelligence (MCI + BCI)  
Layer 4 — Risk & Regime Classification

---

# 10. DESIGN PHILOSOPHY

MCI answers: "Who holds?"  
BCI answers: "How coordinated?"  
Hybrid answers: "How structurally authentic?"

Together they form a deterministic, reproducible Solana Onchain Intelligence Model.

---

END OF SPEC

