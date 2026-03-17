## implementing-tasks.md — Gnomes Lore + Matrix (repo-first)

Ziel: Implementierung der **earth-bound** „Gnomes Lore + Matrix“-Schicht als **SSOT-strenge Erweiterung** der bereits vorhandenen GNOMES-Architektur (Routing → Prompt-Komposition → Memory/Writeback → World/Civilization).

Leitplanken (müssen durchgehend gelten):
- **repo-first**: An bestehende Pfade/Mechaniken andocken (`src/routing/gnomeSelector.ts`, `src/prompts/composeGnomePrompt.ts`, `prompts/fragments/*`, Lore/Writeback).
- **SSOT & Drift-Control**: klare Trennung zwischen *kanonisch* vs. *derivativ* vs. *experimentell*.
- **Retrieval-tauglich**: Lore/Matrix als **kleine, tagbare Units** (kein Fluff-Text ohne operative Funktion).
- **Finance-/Stability-/Anti-hype-Kern**: keine CTA/Advice-Formulierungen, keine „DYOR/kauf/verkauf“, kein Wallet-Output.

---

## Phase 0 — Repo Prep / Source Mapping (schnell, blockers klären)

- [ ] **(CRITICAL)** Datenquelle für Gnome-Profile als SSOT fixieren: `data/gnomes/*.yaml`
  - **Warum**: `src/gnomes/loadGnomes.ts` lädt aus `DATA_DIR/gnomes/*.yaml`; aktuell fehlen diese Files im Repo (GNOMES fällt auf Default/Fallback zurück).
  - **Akzeptanz**: `data/gnomes/` existiert im Repo und enthält mind. 7 Profile (siehe Phase 2). Tests/Runtime können gnomes laden.

- [ ] **(CRITICAL)** Schema-Alignment festlegen: `schemas/gnome_profile.schema.json` ↔ `src/gnomes/types.ts`
  - **Warum**: Schema-Archetypes/Voice-Felder weichen von TS-Types ab → Drift-/Validierungsrisiko.
  - **Akzeptanz**: Entscheidung dokumentiert (ADR) und Schema/TS sind konsistent (entweder Schema an TS anpassen oder TS an Schema).

---

## Phase 1 — Canon Establishment (Docs als höchste Autorität)

Neue kanonische Docs (in `docs/lore/`):
- [ ] `docs/lore/GNOMES_MATRIX.md`
  - Enthält: Rollen, Symbolik/Alchemie, Kernfunktion, Schattenseite, Voice-Regeln, Market-Regime-Fit, Emotion-Regulation, Retrieval-Tags, Forbidden Patterns, Role-Blend-Regeln.
  - **Akzeptanz**: Jede Rolle ist eindeutig unterscheidbar (Voice-Diff), und enthält operative Use-Cases (Posting/Retrieval).

- [ ] `docs/lore/GNOMES_LORE_UNITS.md`
  - Policy: Unit-Typen, Granularität, Chunking, Tag-Taxonomie, Embed/No-Embed, Status-Lifecycle (candidate→approved→active).
  - **Akzeptanz**: klare Regeln, welche Inhalte *nie* embedded werden.

- [ ] `docs/lore/GNOMES_GOVERNANCE.md`
  - Canon Control: SSOT-Dateien, Änderungsprozess, Review/Activation, Drift-Prevention, Experiment-Trennung.
  - **Akzeptanz**: „active only influences prompts“ ist explizit.

Repo-Index aktualisieren:
- [ ] `docs/lore/README.md` erweitern (Links auf die neuen Canon-Dokumente)
- [ ] Optional: `docs/README.md` ergänzen (Governance-Regel analog zu ENV-SSOT)

Neue ADR:
- [ ] `docs/decisions/004-gnomes-canon-ssot.md`
  - Entscheidung: SSOT-Set, Schema-Alignment, Status-Lifecycle, Role-blends, Dominanz-Caps.

---

## Phase 2 — Matrix Definition (7 earth-bound Rollen als echte GNOMES)

### 2.1 Gnome Profiles (YAML) — runtime SSOT

Pfad: `data/gnomes/`

Anlegen (mindestens):
- [ ] `data/gnomes/stillhalter.yaml`
- [ ] `data/gnomes/erzlauscher.yaml`
- [ ] `data/gnomes/muenzhueter.yaml`
- [ ] `data/gnomes/nebelspieler.yaml`
- [ ] `data/gnomes/wurzelwaechter.yaml`
- [ ] `data/gnomes/pilzarchitekt.yaml`
- [ ] `data/gnomes/glutkern.yaml`

Jede Datei muss enthalten (repo-fit):
- `id` (snake_case, lowercase)
- `name` (Display)
- `role` (kurzer role-key, z. B. `treasury_restraint`, `subsurface_due_diligence`, …)
- `archetype` (muss zur finalen TS/Schema-Entscheidung passen)
- `voice_traits` (0–10): `dryness`, `warmth`, `sarcasm`, `theatricality`, `meme_density`
- `language_prefs`: `primary`, `allow_slang`, `preferred_keywords`
- `routing_hints`: `preferred_intents`, `preferred_energy`, `aggression_range`, `absurdity_threshold`
- `memory_rules`: `track_affinity`, `track_jokes`, `max_items_per_user`
- `safety_boundaries` (harte, nicht überschreibbare Regeln)
- Optional: `lore_tags_default` (für Lore Units)

Akzeptanz:
- `GNOMES_ENABLED=true` lädt Profiles fehlerfrei.
- `selectGnome()` kann die 7 Rollen in plausiblem Regime routen (intent/aggression/absurdity/affinity).

### 2.2 Prompt-Fragments (Voice) — SSOT für „posting-native“

Pfad: `prompts/fragments/gnomes/`

Anlegen:
- [ ] `stillhalter.md`
- [ ] `erzlauscher.md`
- [ ] `muenzhueter.md`
- [ ] `nebelspieler.md`
- [ ] `wurzelwaechter.md`
- [ ] `pilzarchitekt.md`
- [ ] `glutkern.md`

Jedes Fragment muss enthalten:
- **Voice**: Cadence, Satzlänge, Wortschatz, Meme-Dichte (mit Cap), Ironie-Level, Seriousness-Ratio
- **Signature moves** (2–4)
- **Emotion regulation**: wie reagiert die Rolle bei Aggression/Chaos/Unklarheit
- **Forbidden patterns**: konkrete „must never“ (z. B. CTA/Advice, Slang-Overuse, Meta-AI)
- **CT/X-use-cases**: Reply/Quote/Thread-Use, aber weiterhin 280-char-bounded (bzw. Pipeline-Budget)

Dominanz-Kontrolle:
- [ ] Nebelspieler explizit cappen: darf nie Hard-Caution/Neutral-Clarification dominieren, Meme-Dichte begrenzen.

### 2.3 Shared Canon ergänzen (nur wenn nötig, minimal)

Pfad: `prompts/fragments/sharedCanon.md`
- [ ] Ergänzen um **Matrix-weite** constraints für „earth-bound finance“ (ohne Advice-Formulierungen).
  - Akzeptanz: Shared Canon bleibt kurz, und kollidiert nicht mit `globalSafety.md`.

---

## Phase 3 — Vector-/Memory Layer (Units, Status, Retrieval)

Neue Memory-Artefakte (repo-root Folder oder `data/`-nah; empfohlen im Repo: `memory/lore/`):
- [ ] `memory/lore/lore_units.approved.jsonl` (kanonisch: review/approved/active)
- [ ] `memory/lore/lore_units.candidates.jsonl` (derivativ, experimentell)
- [ ] `memory/lore/matrix_units.v1.yaml` (kanonisch: strukturierte Mirror-View der Matrix; optional wenn SSOT = MD bleibt)

Unit-Policies (müssen in `GNOMES_LORE_UNITS.md` stehen und eingehalten werden):
- Lore Units sind **micro-chunks** (1 Aussagekern), tagbar, statusgeführt.
- Embed **ja**: kurze lore_unit/matrix_unit „Funktion + Ton + Use-Case“.
- Embed **nein**: verbotene Listen, harte Compliance-Regeln, interne Schwellen/Scoring, Regex.
- „Active only influences prompts“ strikt.

Akzeptanz:
- Retrieval kann (minimal) 3–5 Units für Prompt-Komposition liefern, ohne Prompt zu überfüllen.
- Units sind versionierbar und nicht redundant.

---

## Phase 4 — Prompt/Runtime Integration (minimal-invasive)

Ziel: keine neue Pipeline erfinden; vorhandene Joinpoints nutzen.

- [ ] `src/memory/sharedLoreStore.ts` / Lore retrieval: optional erweitern, um `lore_units.*` als Quelle zu nutzen (statt nur LoreStore).
- [ ] `src/prompts/composeGnomePrompt.ts`: Lore Units als „Shared lore“ bzw. role-spezifische lore einfügen (budgeted).
- [ ] Routing overrides (wenn nötig): harte Regeln für Mode-Kompatibilität (z. B. Nebelspieler nicht bei `hard_caution`).

Akzeptanz:
- GNOMES on/off funktioniert weiterhin.
- Keine Verletzung von `globalSafety.md` und validator constraints.

---

## Phase 5 — Validation (Tests gegen Drift & Rollenverwechslung)

Neue Testsuite:
- [ ] `tests/prompts/gnomes_matrix_regression.jsonl`
  - Fälle pro Rolle (mind. 5), plus confusion cases (Stillhalter vs Erzlauscher, Münzhüter vs Wurzelwächter, Nebelspieler vs alle).
  - Akzeptanz: Rollen sind stilistisch unterscheidbar und halten Forbidden Patterns ein.

Optional (wenn ihr fingerprinting nutzt):
- [ ] Drift-Suite pro Rolle im Stil der bestehenden `llm-terminal-test-bundle/tests/prompts/*`.

---

## Phase 6 — Growth Loop (ohne Drift)

- [ ] Prozess definieren: wie neue Rollen/Blends/Lore-Units eingeführt werden (PR, Review, Statuswechsel).
- [ ] Operator Controls: optional UI/flags für Lore Expansion, World Events (FeatureGates/Overrides existieren).
- [ ] Regel: Experimente bleiben in `candidates` und dürfen nicht „active“ werden ohne Review.

Akzeptanz:
- Wachstum erzeugt keine Meme-/Voice-Verwässerung.
- Nebelspieler dominiert nicht.
- Wealth/Stability/Anti-hype bleibt Kern.

---

## Blocker Checklist (CRITICAL)

- [ ] `data/gnomes/*.yaml` existiert im Repo und wird von `loadGnomes()` geladen.
- [ ] `schemas/gnome_profile.schema.json` ↔ `src/gnomes/types.ts` sind konsistent.
- [ ] Rollen sind in Prompt-Fragments implementiert (nicht nur in Docs).
- [ ] Lore Units sind statusgeführt („active only influences prompts“).

