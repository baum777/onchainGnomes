# X OAuth2 Render Integration

## Architekturüberblick
- Zentrale OAuth2- und API-Schicht liegt in:
  - `src/clients/xOAuthToken.ts`
  - `src/clients/xApi.ts`
- Alle X API Calls sollen über `invokeXApiRequest` laufen.
- Access Token wird **nur in-memory** gehalten (pro Prozess), inklusive Metadaten (`token_type`, `expires_in`, `created_at`, `expires_at`).

## Lokal vs. Render
- **Lokal**:
  - Prozess-Environment hat Priorität.
  - `.env.oauth2` wird als Fallback gelesen.
- **Render**:
  - Nur Runtime-Environment-Variablen sind SSOT.
  - `.env.oauth2` wird nicht als Runtime-Store genutzt.
  - Access Tokens werden nicht in Dateien persistiert.

## Warum `.env.oauth2` auf Render nicht als Runtime-Store
Render-Container-Filesystem ist typischerweise ephemer. Runtime-Persistenz in Dateien ist damit nicht robust; zusätzlich sind Cron Jobs ohne Persistent Disk. Daher ist die robuste Basis auf Render:
- Secrets in Render Environment Variables / Environment Groups.
- Access Token als flüchtiger Runtime-Wert in Memory.
- Refresh per `X_REFRESH_TOKEN` bei Bedarf.

## Render Constraints (wichtig)
- Ephemeres Filesystem.
- Persistent Disks nur für Web/Private/Worker.
- Keine Persistent Disks bei Cron Jobs.
- Environment Variables sind bevorzugte Secret-Quelle.
- Env-Änderungen werden nicht zuverlässig live in laufende Prozesse injiziert.

## Erforderliche Variablen auf Render
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_REFRESH_TOKEN`

Optional:
- `X_ACCESS_TOKEN`
- `X_EXPIRES_IN`
- `X_TOKEN_CREATED_AT`
- `X_REFRESH_BUFFER_SECONDS` (default `300`)
- `X_OAUTH_TOKEN_URL` (default `https://api.x.com/2/oauth2/token`)
- `X_BOT_USER_ID`
- `X_BOT_USERNAME`

## Setup Beispiele
### Web Service
- Secrets als `envVars` oder via `envVarGroups` referenzieren.
- Keine Token-Dateien schreiben.

### Background Worker
- Gleiche Konfiguration wie Web Service.
- In-memory Token-Cache wird pro Worker-Prozess gehalten.

### Cron Job
- Gleiches OAuth2-Setup ohne Disk-Abhängigkeit.
- Pro Run kann frisch refreshed werden.

## Refresh-Token-Rotation
Wenn der Provider bei Refresh einen neuen `refresh_token` liefert:
- Laufzeit loggt Warnung (maskiert) und markiert `nextRefreshToken`.
- Keine automatische Rückschreibung in Render Env Vars.
- Für harte Rotation ist ein zentraler persistenter Store nötig (z. B. Postgres/KV), nicht Dateisystem im Container.

## Test-/Debug-Aufrufe
- `pnpm exec tsx scripts/check_auth.ts`
- `pnpm exec tsx scripts/_x_smoke.ts`
- `pnpm exec tsx scripts/debug_mentions.ts`
- `pnpm exec tsx scripts/test_poll_logic.ts`
