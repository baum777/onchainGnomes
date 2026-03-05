Hier ist die **finale, konsolidierte MCI–BCI Spezifikation (Engine v4.5 Final)** – formal, deterministisch und prompt-/agent-/swarm-kompatibel.

---

# 📘 MCI–BCI FINAL SPEC

**Engine Version:** v4.5
**Status:** Production-Ready
**Scope:** Onchain Behavioral + Coordination Intelligence Layer

---

## 1️⃣ MCI — Moralis Composite Intelligence

**Kategorie:** Behavioral Intelligence
**Zweck:** Bewertung der Holder-Qualität, organischen Struktur und Bot-/Sniper-Risiken.
**Skala:** 0–100

### 1.1 Formel (final)

```text
MCI =
0.25 × holder_stability
+0.20 × bot_suspicion_inverse
+0.20 × sniper_risk_score
+0.15 × holder_growth_velocity
+0.10 × supply_distribution_index
+0.10 × moralis_token_score
```

### 1.2 Sub-Metriken (normiert auf 0–100)

| Sub-Metrik                | Definition                  | Logik                                    |
| ------------------------- | --------------------------- | ---------------------------------------- |
| holder_stability          | Stabilität der Holder-Basis | 100 − abs(change_1h_percent)             |
| bot_suspicion_inverse     | Inverser Bot-Anteil         | 100 − bot_proxy_percent                  |
| sniper_risk_score         | Früh-Sniper Aktivität       | normiert nach sniper_count/launch_window |
| holder_growth_velocity    | ΔHolder (1h vs Avg)         | normalisierte Wachstumsrate              |
| supply_distribution_index | Dezentralisierung           | 100 − (top10_supply_percent × 2)         |
| moralis_token_score       | Externer Onchain-Score      | 0–100 API-Wert                           |

### 1.3 Fallback-Regel

```text
If moralis_key_missing:
    MCI = 45
```

### 1.4 Interpretation

| Bereich | Bedeutung                            |
| ------- | ------------------------------------ |
| >75     | Stark organisch                      |
| 50–75   | Neutral / Mischstruktur              |
| <50     | Hohe Manipulationswahrscheinlichkeit |

---

## 2️⃣ BCI — BundleCluster Intelligence

**Kategorie:** Coordination Intelligence
**Zweck:** Detektion koordinierter Launch-Manipulation, Bundles, Sybil-Cluster.
**Skala:** 0–100

### 2.1 Formel (final)

```text
BCI =
0.35 × bundle_clean_score
+0.35 × cluster_diversity_index
+0.20 × smart_money_cluster_score
+0.10 × (100 − timing_anomaly_score)
```

### 2.2 Sub-Metriken

| Sub-Metrik                | Definition                 | Logik                                             |
| ------------------------- | -------------------------- | ------------------------------------------------- |
| bundle_clean_score        | Inverser Bundle-Anteil     | 100 − bundle_risk_score                           |
| bundle_risk_score         | Launch-Koordination        | (bundle_ratio × 80) + launch_bundle_flag × 20     |
| cluster_diversity_index   | Wallet-Diversität          | 100 − sqrt(max_cluster_size / totalHolders) × 100 |
| smart_money_cluster_score | Label-basierte Legitimität | min(100, smart_wallets_top20 × multiplier)        |
| timing_anomaly_score      | Tx-Burst-Detektion         | normierte Anzahl <3s Gruppen                      |

### 2.3 Fallback-Regel

```text
If tx_data_missing OR graph_missing:
    BCI = 45
```

### 2.4 Interpretation

| Bereich | Bedeutung                    |
| ------- | ---------------------------- |
| >75     | Koordinationsarm / Organisch |
| 50–75   | Mischstruktur                |
| <50     | Hohe Bundle-/Sybil-Risiken   |

---

## 3️⃣ Hybrid Intelligence (Final Harmonization)

### 3.1 Altersabhängige Gewichtung

```text
If age < 1h:
    Hybrid = 0.35×MCI + 0.65×BCI

Else if age < 24h:
    Hybrid = 0.50×MCI + 0.50×BCI

Else if age ≥ 7d:
    Hybrid = 0.70×MCI + 0.30×BCI

Else:
    Hybrid = 0.55×MCI + 0.45×BCI
```

### 3.2 Governance-Regel (Double-Penalty-Schutz)

```text
If MCI <45 AND BCI <45:
    manipulation_weight_delta =
    max(0.20, 0.25)
Else:
    manipulation_weight_delta =
    min(0.35, sum_of_individual_penalties)
```

---

## 4️⃣ Integration in Engine

| Phase       | Integration                           |
| ----------- | ------------------------------------- |
| PHASE 3     | Structural += (0.35×MCI) + (0.25×BCI) |
| PHASE 4     | Narrative-Type beeinflusst durch BCI  |
| PHASE 6     | Manipulation Boost bei MCI/BCI <45    |
| SECTION D/E | Separate Spalten MCI, BCI, Hybrid     |

---

## 5️⃣ Korrelation & Overlap Governance

```text
If corr(MCI, BCI) > 0.75:
    Reduce additive penalty stacking
```

Ziel: Vermeidung redundanter Risikoüberbewertung.

---

## 6️⃣ Systemprinzipien

* Alle Subscores ∈ [0,100]
* Alle Gewichte fixiert & dokumentiert
* Keine spekulativen Inputs
* Deterministische Berechnung
* Cap manipulation_boost ≤ 0.35
* Prompt-/Agent-/Swarm-kompatibel

---

# 🏁 FINAL POSITIONIERUNG

MCI beantwortet:

> Wer hält und wie organisch ist die Struktur?

BCI beantwortet:

> Wie koordiniert wurde gekauft oder manipuliert?

Hybrid beantwortet:

> Wie vertrauenswürdig ist die Onchain-Integrität dieses Tokens?

Gemeinsam bilden sie das **Onchain-Behavioral + Coordination Forensics Core** der Engine v4.5.

---
