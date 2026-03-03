## Architektur-Meta-Zusammenfassung als hierarchischer Baukasten (harmonisiert für Merge)

Unten ist eine **hierarchische Ordnung nach “relatedness”** + ein **harmonisiertes Merge-Model** (damit du die Inhalte als **Prompt-Architektur-Baukasten** deterministisch zusammenführen kannst).

---

## 1) System-Layer-Diagramm (Top → Down)

```text
┌──────────────────────────────────────────────────────────────┐
│ L0 — ORCHESTRATION / GOVERNANCE                              │
│  • GROK_meta-Engine.md                                       │
│  → entscheidet: welche Engine läuft, wie gewichtet, Fallback │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ L1 — ENGINE CORE (Signal- & State-Machine)                   │
│  • engine_v_4.md                                             │
│  → vereinheitlicht: Inputs → Features → Scores → Decisions   │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ L2 — SCORING / FORMAL MODEL                                  │
│  • MATHEMATISCHE-GESAMTFORMEL.md                             │
│  • bci-mci.md                                                │
│  → liefert: gemeinsame Scores/Indizes + Normalisierung       │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ L3 — DOMAIN ENGINES (Specialists)                            │
│  • Onchain-Forensic-Intelligence-Engine.md                   │
│  → onchain signals: wallet patterns, risk flags, narratives  │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ L4 — RESILIENCE / DEGRADED OPS                               │
│  • ReducedMode_Failure-Resilient_Cross-DEX.md                │
│  → fallback policy: multi-source, graceful degrade, gating   │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ L5 — USER INTERFACE ADAPTERS                                 │
│  • User-Intent-nlp.md                                        │
│  → natural language → structured intent → engine actions     │
└──────────────────────────────────────────────────────────────┘
```

**Lesart:**

* **Meta-Engine (L0)** orchestriert.
* **Engine v4 (L1)** ist der “Runtime-Kern”.
* **Math + Indizes (L2)** sind die gemeinsame Sprache für Scores.
* **Forensic (L3)** liefert spezielle Signale.
* **ReducedMode (L4)** hält alles am Leben bei Daten-Ausfall.
* **Intent NLP (L5)** ist der Eingangsadapter.

---

## 2) Relatedness-Cluster (für sauberen Merge)

### Cluster A — “Decision & Routing”

* **GROK_meta-Engine.md** (Policy, Routing, Weighting, Governance)
* **engine_v_4.md** (State-Machine, Decision Pipeline)

**Harmonisierung:**
Einheitliches Konzept: **DecisionRequest → DecisionResult** (siehe Contracts unten).

---

### Cluster B — “Unified Scoring Language”

* **MATHEMATISCHE-GESAMTFORMEL.md** (Master-Score-Formel)
* **bci-mci.md** (Index-System für Zustände/Regime)

**Harmonisierung:**
Alles auf **ein Score-Schema** mappen: `scores.*` + `indices.*` + `confidence`.

---

### Cluster C — “Domain Signals”

* **Onchain-Forensic-Intelligence-Engine.md**

**Harmonisierung:**
Output immer als **Signals + Evidence** (nicht als “Entscheidung”), damit L1/L0 gewichten können.

---

### Cluster D — “Reliability & Fallback”

* **ReducedMode_Failure-Resilient_Cross-DEX.md**

**Harmonisierung:**
Formalisieren als **DataQuality + FallbackMode + SourceHealth**.

---

### Cluster E — “Input / UX”

* **User-Intent-nlp.md**

**Harmonisierung:**
Ergebnis ist **IntentSpec** (keine direkte Engine-Ausführung).

---

## 3) Prompt-Architektur-Baukasten (Module-Blueprint)

Damit du das als “Prompt Baukasten” mergen kannst, empfehle ich **7 Prompt-Module** (einzeln versionierbar):

1. **`P0_SYSTEM_ROLE`**

   * Wer bin ich (Meta-Engine vs Engine-Core vs Specialist)
2. **`P1_CONTRACTS`**

   * JSON Schemas / IO-Verträge (siehe unten)
3. **`P2_ROUTING_POLICY`** *(aus GROK_meta-Engine)*

   * wann welche Engine, Gewichtung, Fail-Closed
4. **`P3_ENGINE_RUNTIME`** *(aus engine_v_4)*

   * State machine, steps, decision flow
5. **`P4_SCORING_MODEL`** *(Math + BCI/MCI)*

   * Normalisierung, aggregation, thresholds
6. **`P5_DOMAIN_SPECIALISTS`** *(Onchain forensic)*

   * signal catalog, risk flags, evidence format
7. **`P6_RESILIENCE`** *(ReducedMode)*

   * fallback modes, source health, degraded outputs

---

## 4) Harmonisiertes Contract-Set (Merge-Standard)

### 4.1 `IntentSpec` (aus User-Intent-nlp)

```json
{
  "intent": "analyze_token | analyze_wallet | trade_setup | explain | alert_rule",
  "entities": { "token": "...", "wallet": "...", "chain": "solana|evm", "dex": "..." },
  "constraints": { "risk": "low|med|high", "timeframe": "scalp|swing|long" },
  "output_preference": { "format": "brief|full", "language": "de|en" }
}
```

### 4.2 `DataQuality` (aus ReducedMode)

```json
{
  "source_health": { "dexscreener": "ok|degraded|down", "birdeye": "ok|degraded|down" },
  "mode": "normal|reduced|offline",
  "confidence_floor": 0.0,
  "notes": ["..."]
}
```

### 4.3 `SignalPack` (aus Forensic + generell)

```json
{
  "signals": [
    { "name": "wallet_cluster_risk", "value": 0.82, "weight": 0.6, "evidence": ["tx..."], "confidence": 0.7 }
  ],
  "evidence": { "links": [], "tx": [], "notes": [] }
}
```

### 4.4 `ScoreCard` (aus Math + BCI/MCI)

```json
{
  "scores": { "risk": 0.73, "momentum": 0.41, "quality": 0.62 },
  "indices": { "bci": 0.58, "mci": 0.64 },
  "thresholds_hit": ["risk>0.7"],
  "confidence": 0.66
}
```

### 4.5 `DecisionResult` (aus Engine v4 + Meta)

```json
{
  "decision": "allow|warn|block|monitor",
  "recommendation": "buy|sell|hold|avoid|wait",
  "rationale_bullets": ["..."],
  "scorecard": { },
  "data_quality": { },
  "trace": { "routes": ["forensic", "scoring"], "version": "engine_v4" }
}
```

**Wichtig:** Spezial-Engines liefern **SignalPack**, nicht Decision. Decision passiert in **L1/L0**.

---

## 5) Merge-Regeln (damit es “harmonisch” bleibt)

* **Single Source of Truth für Scores:** Alles endet in `ScoreCard`.
* **Evidence ≠ Opinion:** Jede harte Aussage braucht `evidence[]` oder wird als “hypothesis” markiert.
* **ReducedMode ist ein Querschnitt:** darf die Output-Form ändern (kürzer), aber nicht “halluzinieren”.
* **Meta-Engine darf nur routen/gewichten:** keine Domain-Details duplizieren (sonst Drift).
* **Naming:** Englisch für Keys (`risk`, `confidence`), DE/EN nur für Textausgabe.

---

## 6) Empfohlene Repo-Struktur für den Prompt-Baukasten

```text
prompts/
  baukasten/
    00_system_role.md
    01_contracts.json
    02_routing_policy.md
    03_engine_runtime.md
    04_scoring_model.md
    05_domain_forensics.md
    06_resilience.md
  composed/
    meta_engine.prompt.md          (stitch: 00+01+02+06)
    engine_v4.prompt.md            (stitch: 00+01+03+04+06)
    forensic_specialist.prompt.md  (stitch: 00+01+05+06)
```

---