ENGINE v4.5 — MATHEMATISCHE GESAMTFORMEL

Definitionsbereich:
Alle Subscores ∈ [0,100]
Alle Gewichte deterministisch fixiert
Caps & Fail-Closed-Regeln global erzwungen

────────────────────────────────────────
LAYER 1 — DATA VALIDATION

relative_delta = |sourceA − sourceB| / max(sourceA, sourceB)

cross_source_confidence_score =
100 − (discrepancy_rate_percent)

If valid_tokens < 30 → ABORT

────────────────────────────────────────
LAYER 2 — CORE RISK MODEL (PHASE 2)

Liquidity_Risk      ∈ [0,100]
Social_Manipulation ∈ [0,100]
Momentum_Exhaustion ∈ [0,100]
Structural_Weakness ∈ [0,100]

Base_Risk =
0.40 × Liquidity_Risk
+0.25 × Social_Manipulation
+0.20 × Momentum_Exhaustion
+0.15 × Structural_Weakness

────────────────────────────────────────
LAYER 3 — MCI (Behavioral Intelligence)

MCI =
0.25 × holder_stability
+0.20 × bot_suspicion_inverse
+0.20 × sniper_risk_score
+0.15 × holder_growth_velocity
+0.10 × supply_distribution_index
+0.10 × moralis_token_score

If moralis_key_missing → MCI = 45

────────────────────────────────────────
LAYER 4 — BCI (Coordination Intelligence)

BCI =
0.35 × bundle_clean_score
+0.35 × cluster_diversity_index
+0.20 × smart_money_cluster_score
+0.10 × (100 − timing_anomaly_score)

If tx/graph_missing → BCI = 45

────────────────────────────────────────
LAYER 5 — HYBRID INTELLIGENCE (Age-Adjusted)

If age < 1h:
    Hybrid_Intelligence =
    0.35 × MCI + 0.65 × BCI

Else if age < 24h:
    Hybrid_Intelligence =
    0.50 × MCI + 0.50 × BCI

Else if age ≥ 7d:
    Hybrid_Intelligence =
    0.70 × MCI + 0.30 × BCI

Else:
    Hybrid_Intelligence =
    0.55 × MCI + 0.45 × BCI

────────────────────────────────────────
LAYER 6 — STRUCTURAL ENHANCEMENT

Structural_Final =
Structural_Weakness
+ (0.35 × MCI)
+ (0.25 × BCI)

Cap Structural_Final at 100

────────────────────────────────────────
LAYER 7 — MANIPULATION STACK CONTROL

If MCI < 45:
    manipulation_boost_MCI = 0.15
Else:
    manipulation_boost_MCI = 0

If BCI < 45:
    manipulation_boost_BCI = 0.20
Else:
    manipulation_boost_BCI = 0

manipulation_weight_delta =
min(0.35, max(manipulation_boost_MCI,
              manipulation_boost_BCI))

Final_Risk =
Base_Risk × (1 + manipulation_weight_delta)

────────────────────────────────────────
LAYER 8 — GLOBAL INTELLIGENCE SCORE

Global_Intelligence_Index =
0.50 × Hybrid_Intelligence
+0.30 × (100 − Final_Risk)
+0.20 × cross_source_confidence_score

Normalize to [0,100]

────────────────────────────────────────
OUTPUT CONTRACT

For each token output:
- Base_Risk
- MCI
- BCI
- Hybrid_Intelligence
- Structural_Final
- Final_Risk
- Global_Intelligence_Index
- cross_source_confidence_score

All values traceable.
No speculative components.
Fail-closed enforced.