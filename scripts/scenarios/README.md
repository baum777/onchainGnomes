# Konversations-Szenarien (JSONL)

Szenarien für `pnpm simulate` und `pnpm simulate:ci`. Jede Zeile = ein Szenario (ein JSON-Objekt).

## Format

```json
{"name":"szenario-name","turns":[{"userInput":"...","skipPipeline":true},{"userInput":"@GORKY_ON_SOL ...","expectedKeywords":["keyword1","keyword2"]}]}
```

### Turn-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `userInput` | string | User-Nachricht (mit oder ohne @GORKY_ON_SOL) |
| `skipPipeline` | boolean | Wenn `true`: Turn dient nur als Kontext für nächsten Turn, Pipeline wird nicht aufgerufen |
| `description` | string | Optionale Beschreibung (z.B. "Parent-Tweet") |
| `expectedKeywords` | string[] | Erwartete Keywords in der Bot-Antwort (case-insensitive) |

### Beispiele

- **Reply-Szenario**: Erster Turn mit `skipPipeline: true` = Parent-Tweet, zweiter Turn = User fragt Gorky im Kontext des Parents
- **Multi-Turn**: Mehrere Turns ohne `skipPipeline` = vollständiger Dialog User → Bot → User → Bot …

## Verwendung

```bash
# Standard (lädt scripts/scenarios/conversation_scenarios.jsonl)
pnpm simulate

# Eigene Szenarien-Datei
pnpm simulate --file path/to/my_scenarios.jsonl

# CI-Modus: Exit 1 bei Fehlschlag (Keywords fehlen, Pipeline-Skip)
pnpm simulate:ci
```
