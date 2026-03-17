# Abweichungen vom gnomes_master_spec_bundle

## Kontext

Die Datei `gnomes_master_spec_bundle.zip` ist im Repository nicht vorhanden (Suche: 0 Treffer).
Die Implementierung folgt daher **Option B**: Architektur, Schemas und Datenstrukturen werden aus den
Phase-Prompts ([PHASE1–PHASE5](.)) und dem bestehenden Code abgeleitet.

## Abgeleitete Strukturen

### Gnome-Profil (YAML)

Basierend auf PHASE-1: Jedes Profil enthält:
- `id`, `name`, `role`, `archetype`
- `voice` (traits, Sprache)
- `routing_hints` (weights für Intent, Aggression, etc.)
- `memory_rules` (was gespeichert/vergessen werden darf)

### Database

Das Bundle verweist auf PostgreSQL + pgvector. Das Projekt nutzt aktuell SQLite-kompatible
Migrationen unter `src/state/migrations/`. Die GNOMES-Tabellen werden:
- SQLite-kompatibel definiert
- ohne pgvector (Vektor-Speicher optional für spätere Phasen)
- mit JSONB-ähnlichen Feldern als TEXT (SQLite JSON1-Extension)

### Schemas

- `schemas/gnome_profile.schema.json`: Aus PHASE-1-Beschreibung abgeleitet
- Kein Bundle-Schema als Referenz; Felder entsprechen den Phase-Prompt-Anforderungen

### Gnomen-Daten

- `data/gnomes/gorky.yaml`: Aus `src/context/prompts/gorkypf/` und canonical promptBuilder abgeleitet
- `data/gnomes/moss.yaml`, `spark.yaml`: Stub-Definitionen für Tests (PHASE-1-Anhang)

## Dokumentierte Abweichungen

| Aspekt | Bundle (angenommen) | Implementierung |
|--------|--------------------|-----------------|
| DB-Engine | PostgreSQL | SQLite (bestehende Infrastruktur) |
| Vector-Memory | pgvector | In Phase-1 nicht verwendet |
| Gnome-Pfad | `data/gnomes/*.yaml` | `data/gnomes/*.yaml` (identisch) |
| Prompt-Fragmente | `prompts/fragments/` | `prompts/fragments/` (identisch) |

## Nächste Schritte

Sobald `gnomes_master_spec_bundle.zip` bereitgestellt wird:
1. Bundle entpacken
2. Strukturen in diesem Dokument mit `specs/`, `database/`, `schemas/` abgleichen
3. Abweichungen ggf. in späteren Migrationen anpassen
