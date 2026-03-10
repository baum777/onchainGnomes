# Gorky Test Kit

Dieses Bundle testet **Gorky** auf **Persona-, Stil- und Charakter-Konsistenz** im Terminal auf Basis deines bestehenden LLM-Test-Harness.

## Ziel

Die Suite prüft, ob Gorky stabil bleibt als:

- mature
- chain-native
- trocken-sarkastisch
- roastig, aber kontrolliert
- nützlich ohne in generischen Assistant-Ton zu kippen

Zusätzlich werden typische Drift-Richtungen abgefangen:

- zu süß / motivational
- customer-support-artig
- corporate-consultant-artig
- kindlich / niedlich
- substanzloser Hype-Ton

---

## Inhalt des Bundles

```text
gorky_test_kit/
├─ README_GORKY_TESTING.md
├─ prompts/
│  └─ gorky_system.txt
├─ tests/
│  └─ prompts/
│     ├─ gorky_persona_consistency.jsonl
│     └─ gorky_drift_suite.jsonl
├─ scripts/
│  ├─ run_gorky_persona.sh
│  ├─ run_gorky_drift.sh
│  └─ run_gorky_all.sh
└─ logs/
```

---

## Voraussetzungen

- Node.js 20+
- Python 3.9+
- pnpm
- funktionierender LLM Terminal Test Harness
- API-Key für xAI oder OpenAI

---

## Einbindung in dein bestehendes Harness

Dieses Kit ist **kein eigener vollständiger Harness**, sondern ein **Testsatz**, den du in dein vorhandenes Projekt integrierst.

### Erwartete Zielstruktur

Die Dateien gehören in ein Projekt, das bereits diese Befehle unterstützt:

```bash
python src/cli.py --mode file --file tests/prompts/smoke.jsonl
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline --suite tests/prompts/regression_suite.jsonl --model grok-3
```

Wenn dein Harness bereits läuft, kopiere die Inhalte dieses Bundles in dessen Root oder merge die Unterordner passend hinein.

---

## Setup

### 1. Dateien entpacken

Entpacke das ZIP-Bundle.

### 2. In den Harness-Ordner kopieren

Beispiel:

```bash
cp -r gorky_test_kit/prompts ./
cp -r gorky_test_kit/tests ./
cp -r gorky_test_kit/scripts ./
mkdir -p logs
```

Unter Windows per Explorer oder PowerShell entsprechend kopieren.

### 3. API-Key prüfen

In deiner `.env` im Harness muss mindestens einer gesetzt sein:

```env
OPENAI_API_KEY=sk-...
# oder
XAI_API_KEY=xai-...
```

---

## Testdateien

## 1) Persona Consistency Suite

Datei:

```text
tests/prompts/gorky_persona_consistency.jsonl
```

Diese Suite testet, ob Gorky:

- bad logic roastet
- cope als cope benennt
- chain-native klingt
- nicht cute wird
- nicht corporate wird
- nützlich bleibt, ohne weich zu werden

## 2) Drift Suite

Datei:

```text
tests/prompts/gorky_drift_suite.jsonl
```

Diese Suite testet gezielt gegen Unerwünschtes:

- Therapy-Sprech
- Customer-Support-Ton
- Kindlich-Meme-Ton
- Corporate-Consulting-Sprache
- leere Hype-Phrasen

---

## Gorky System Prompt

Datei:

```text
prompts/gorky_system.txt
```

Dieser Prompt definiert die Persona als Single Source of Truth für den Testlauf.

---

## How-To: Testläufe im Terminal

## Interaktiver Test

```bash
python src/cli.py --mode interactive --system-file prompts/gorky_system.txt
```

Gut für manuelle Spot-Checks und Prompt-Iteration.

---

## Persona Suite ausführen

### Linux / macOS

```bash
bash scripts/run_gorky_persona.sh
```

### Direkt ohne Script

```bash
python src/cli.py \
  --mode file \
  --file tests/prompts/gorky_persona_consistency.jsonl \
  --system-file prompts/gorky_system.txt \
  --strict \
  --log-file logs/gorky_persona_run.ndjson
```

---

## Drift Suite ausführen

### Linux / macOS

```bash
bash scripts/run_gorky_drift.sh
```

### Direkt ohne Script

```bash
python src/cli.py \
  --mode file \
  --file tests/prompts/gorky_drift_suite.jsonl \
  --system-file prompts/gorky_system.txt \
  --strict \
  --log-file logs/gorky_drift_run.ndjson
```

---

## Beide Suiten nacheinander ausführen

### Linux / macOS

```bash
bash scripts/run_gorky_all.sh
```

---

## Windows Hinweise

Die mitgelieferten Scripts sind `.sh`-Skripte. Unter Windows hast du drei Optionen:

### Option A: Git Bash nutzen

```bash
bash scripts/run_gorky_all.sh
```

### Option B: PowerShell direkt

```powershell
python src/cli.py --mode file --file tests/prompts/gorky_persona_consistency.jsonl --system-file prompts/gorky_system.txt --strict --log-file logs/gorky_persona_run.ndjson
python src/cli.py --mode file --file tests/prompts/gorky_drift_suite.jsonl --system-file prompts/gorky_system.txt --strict --log-file logs/gorky_drift_run.ndjson
```

### Option C: Eigene `.bat` Wrapper erstellen

Wenn du willst, kannst du später kleine Windows-Wrapper ergänzen.

---

## Behavior Fingerprinting

Für subtile Stil-Drift ist Fingerprinting sehr nützlich.

### Baseline erstellen

```bash
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --suite tests/prompts/gorky_persona_consistency.jsonl \
  --system-file prompts/gorky_system.txt \
  --model grok-3
```

### Gegen Baseline vergleichen

```bash
python tools/behavior_fingerprint/fingerprint_cli.py compare \
  --suite tests/prompts/gorky_persona_consistency.jsonl \
  --baseline tests/fingerprint/baseline_profiles/grok-3.ndjson \
  --system-file prompts/gorky_system.txt
```

> Hinweis: Diese Commands setzen voraus, dass dein Fingerprint-CLI bereits `--system-file` unterstützt. Falls dein Tool das noch nicht kann, erweitere es oder injiziere den System Prompt anderweitig.

---

## Was genau validiert wird

Jeder JSONL-Testfall kann Assertions wie diese nutzen:

- `must_include`
- `must_not_include`
- `max_chars`
- `expect_json`
- `required_keys`

Im Gorky-Kit liegt der Fokus auf:

- Pflichtbegriffen, die zum Charakter passen
- verbotenen Phrasen, die Persona-Drift verraten
- knapper Länge für Stil-Konsistenz

---

## Empfohlene Review-Checkliste

Zusätzlich zu den harten Assertions lohnt sich eine manuelle Review:

```text
[ ] klingt mature
[ ] klingt chain-native
[ ] klingt trocken/sarkastisch
[ ] roastet schlechte Logik
[ ] bleibt nützlich
[ ] kein customer-support ton
[ ] kein corporate consultant ton
[ ] kein kindlich-niedlicher ton
[ ] keine leeren hype-phrasen
[ ] insgesamt klar als Gorky erkennbar
```

---

## Typischer Workflow

### 1. Persona definieren

Passe `prompts/gorky_system.txt` an, bis Gorky sauber sitzt.

### 2. Harte Assertions laufen lassen

```bash
bash scripts/run_gorky_all.sh
```

### 3. Fehlgeschlagene Tests prüfen

Öffne:

```text
logs/gorky_persona_run.ndjson
logs/gorky_drift_run.ndjson
```

### 4. Persona nachschärfen

Schärfe Verbotslisten, Stilregeln oder Testfälle nach.

### 5. Baseline erzeugen

Wenn der Charakter stabil ist:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --suite tests/prompts/gorky_persona_consistency.jsonl \
  --system-file prompts/gorky_system.txt \
  --model grok-3
```

### 6. Drift künftig regelmäßig vergleichen

Vor Releases, Prompt-Änderungen oder Modellwechseln.

---

## Interpretation der Ergebnisse

### Gute Ergebnisse

- Tests bestehen reproduzierbar
- Antworten wirken bissig, klar, chain-native
- Gorky bleibt auch unter adversarialen Prompts in-character

### Schlechte Ergebnisse

- zu weich
- zu generisch
- zu corporate
- zu kindlich
- leerer Hype ohne Analyse

Dann musst du meist:

- den System Prompt schärfen
- mehr negative Assertions ergänzen
- adversarialere Testcases hinzufügen
- gegebenenfalls Modellparameter anpassen

---

## Erweiterungsideen

Du kannst das Kit leicht ausbauen um:

- längere Multi-turn-Konversationen
- JSON-Ausgabe für strukturierte Persona-Scoring-Runs
- automatische Rubric-Evaluation
- Snapshot-Vergleiche pro Modellversion
- getrennte Suiten für Roast, Analyse, Thread-Reply, Market-Commentary

---

## Optional empfohlene nächste Dateien

Sinnvolle Ergänzungen für Version 2:

- `tests/prompts/gorky_multiturn_regression.jsonl`
- `tests/prompts/gorky_market_commentary_suite.jsonl`
- `tests/prompts/gorky_roast_precision_suite.jsonl`
- `docs/gorky_persona_scorecard.md`

---

## Kurzfazit

Dieses Test-Kit prüft nicht nur Output-Qualität, sondern vor allem **charakterliche Stabilität**. Genau das brauchst du, wenn Gorky als feste Agent-Persona zuverlässig konsistent bleiben soll.
