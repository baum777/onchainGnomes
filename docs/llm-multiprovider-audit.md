# LLM Multi-Provider Audit (OpenAI / Anthropic via Env)

## 1. Executive Verdict

**Verdict: conditional fit (mittel bis gut vorbereitet, aber mit zentralen Kopplungsrisiken).**

Das Repo hat bereits ein internes LLM-Interface (`LLMClient`) und nutzt dieses in den Kernpipelines, was eine gute Basis für provider-agnostische Business-Logik ist. Gleichzeitig ist die aktuelle Runtime-Auswahl in `llmClient.unified.ts` technisch „unified“, aber semantisch noch nicht sauber adapterbasiert: Anthropic ist als Provider-Wert erlaubt, wird aber aktuell über den OpenAI-kompatiblen Clientpfad behandelt. Dazu kommen verstreute Env-Validierungen in zwei separaten Config-Layern.

## 2. Current Architecture Snapshot

### Aktuelle LLM-Topologie

- **Internes Port-Interface vorhanden:** `LLMClient.generateJSON(...)` definiert den zentralen Contract für Pipelines.
- **Adapter/Clients:**
  - `llmClient.xai.ts` mit xAI-spezifischer HTTP-Implementierung inkl. Modell-TTL-Fallback bei 403.
  - `llmClient.unified.ts` mit OpenAI-SDK und ENV-Provider-Umschaltung (`xai|openai|anthropic`), aber ohne echten Anthropic-Adapter.
- **Instanziierung:** Worker und Persona-Pfade erzeugen den Client über `createUnifiedLLMClient()` und wrappen via `withCircuitBreaker(...)`.
- **Prompt-Übersetzung:** PromptBuilder produziert internes LLM-Input (`system/developer/user`), das in der Cascade genutzt wird.
- **Response-Normalisierung:** Pipeline erwartet primär strukturierte Felder (z. B. `reply`), toleriert aber teils `reply_text`-Fallbacks in einzelnen Schichten.

### Hauptkopplungen

- Provider-Auswahl und API-Key-Logik ist global in `llmClient.unified.ts` verdichtet (nicht als klarer Resolver + Adapter getrennt).
- xAI hat robustere provider-spezifische Fehler-/Fallback-Logik als der Unified-Client.
- Env-Validierung ist zwischen `env.ts` und `envSchema.ts` verteilt und inkonsistent.

## 3. Coupling & Risk Findings

1. **Stärkste Provider-Kopplung**
   - `llmClient.unified.ts` entscheidet Provider, API-Key, Base-URL und Model in einem Modul (Factory + Adapter + Runtime-Konfig in einem).
   - `anthropic` ist als Provider akzeptiert, jedoch ohne dedizierte Anfrage-/Antwort-Transformation.

2. **Response-Drift-Risiko**
   - `generateJSON` verlässt sich im Unified-Client primär auf `JSON.parse(content)` und degradiert bei Non-JSON auf `reply_text`; xAI nutzt dagegen `safeExtractJSON` mit robustem Cleaning.
   - Unterschiedliche Provider-Antwortformate könnten in `fallbackCascade` still zu Schema-Drift führen.

3. **Env-/Config-Lücken**
   - `env.ts` und `envSchema.ts` modellieren LLM-Konfiguration unterschiedlich (z. B. `LLM_API_KEY`, `XAI_API_KEY`, kein vollständiger OpenAI/Anthropic-Block in beiden).
   - Fail-closed ist teilweise vorhanden (Launch-Checks), aber nicht provider-spezifisch vollständig.

4. **Test-Risiko bei schneller Multi-Provider-Erweiterung**
   - Viele Tests mocken nur `LLMClient` (gut), aber es gibt kaum dedizierte Tests für Provider-Resolver, Adapter-Normalisierung oder Fallback zwischen Providern.

## 4. Minimal Invasive Integration Strategy

1. **Schritt 1: Contract stabilisieren, Business-Layer unverändert lassen**
   - `LLMClient` als zentrale Port-Schnittstelle behalten.
   - Optional intern um Metadaten erweitern (z. B. usage/provider/model), ohne bestehende Aufrufer zu brechen.

2. **Schritt 2: Unified-Client entkoppeln in Resolver + Adapter**
   - `llmClient.unified.ts` zu dünner Factory machen.
   - Neue Adapter pro Provider:
     - `llmClient.adapter.xai.ts` (bestehende xAI-Logik übernehmen/aufrufen)
     - `llmClient.adapter.openai.ts`
     - `llmClient.adapter.anthropic.ts`

3. **Schritt 3: Optionaler Fallback (Primary -> Secondary)**
   - Neuer Wrapper `llmClient.withFallback.ts`: bei transienten Fehlern des Primary optional Secondary nutzen.
   - Nicht bei policy-/auth-Fehlern blind failovern (fail-closed).

4. **Schritt 4: Config vereinheitlichen**
   - Eine zentrale LLM-Env-Parsing-Schicht, auf die `env.ts` und `envSchema.ts` konsistent referenzieren.

## 5. Proposed Architecture

### Internes Contract-Level

- Beibehalten:
  - `generateJSON<T>(input: {system, developer, user, schemaHint?, temperature?, max_tokens?}): Promise<T>`
- Ergänzen (optional, abwärtskompatibel):
  - internes `LLMResultMeta` (provider, model, latency, usage)
  - standardisierte `LLMError`-Klassifikation (`transient`, `auth`, `policy`, `rate_limit`, `invalid_response`)

### Provider-Adapter

- Jeder Adapter liefert denselben internen Output.
- Provider-spezifische Message-Mappings bleiben im Adapter:
  - OpenAI: Chat/Responses Call + JSON-Parsing-Normalisierung.
  - Anthropic: Messages-Format und Content-Block-Extraktion im Adapter.
  - xAI: bestehende robuste Extract-/Fallback-Logik weiterverwenden.

### Factory / Resolver

- `createLLMClientFromEnv()`:
  - liest `LLM_PROVIDER`, provider-spezifische Keys/Model/BaseURL,
  - erstellt Primary-Adapter,
  - wraps optional mit Fallback-Wrapper bei gesetztem Secondary.

### Error-Handling / Fail-Closed

- Auth-/Policy-Fehler: **kein** Provider-Hopping, sofort kontrolliert degradieren.
- Transiente Fehler (429/5xx/Timeout): optional auf Secondary.
- Alle Fehlerpfade liefern sichere Antworthülle statt unhandled crash.

## 6. File-by-File Change Plan

1. `src/clients/llmClient.ts`
   - Contract dokumentieren/leicht erweitern (optionale Meta-Infos, ohne Breaking Change).

2. `src/clients/llmClient.unified.ts`
   - in Factory reduzieren; Provider-Logik in eigene Adapter extrahieren.

3. `src/clients/llmClient.xai.ts`
   - als xAI-Adapter weiterverwenden; optional in neue Adapter-Datei verschieben/re-exportieren.

4. **Neu:** `src/clients/adapters/llmClient.openai.ts`
   - OpenAI-spezifischer Adapter mit robustem JSON-Extractor (gleiches Verhalten wie xAI anstreben).

5. **Neu:** `src/clients/adapters/llmClient.anthropic.ts`
   - Anthropic Message-Übersetzung + Response-Normalisierung.

6. **Neu:** `src/clients/llmProviderResolver.ts`
   - Provider- und Fallback-Auflösung aus Env.

7. **Neu:** `src/clients/llmFallback.ts`
   - Primary/Secondary-Fallback-Policy (nur transient).

8. `src/config/env.ts` und `src/config/envSchema.ts`
   - LLM-Env-Felder konsistent machen, Provider-spezifische Validierung ergänzen.

9. `src/worker/pollMentions.ts`, `src/worker/pollTimelineEngagement.ts`, `src/persona/dailySnippetExtractor.ts`
   - nur Factory-Aufruf beibehalten/umstellen; Business-Logik bleibt unverändert.

## 7. Env / Runtime Plan

Empfohlene minimale, konsistente Variablen:

- Provider-Auswahl:
  - `LLM_PROVIDER` = `xai|openai|anthropic`
  - `LLM_FALLBACK_PROVIDER` = optional

- Provider-spezifisch:
  - xAI: `XAI_API_KEY`, `XAI_MODEL_PRIMARY`, `XAI_MODEL_FALLBACKS`, `XAI_BASE_URL`
  - OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
  - Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`

- Provider-neutral:
  - `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`, `LLM_RETRY_MAX`

Validierungsregel (fail-closed):
- Wenn `LAUNCH_MODE != off`, muss API-Key des **aktiven** Primary Providers vorhanden sein.
- Wenn Fallback gesetzt ist, muss auch dessen Key valide sein, sonst Startup-Fehler.

## 8. Test Plan

1. **Unit: Provider Resolver**
   - korrekte Adapterwahl je `LLM_PROVIDER`
   - Startup-Fehler bei fehlenden Keys

2. **Unit: Adapter-Normalisierung**
   - OpenAI/Anthropic/xAI liefern bei JSON, Non-JSON, leeren Inhalten dieselbe interne Form

3. **Unit: Fallback-Policy**
   - transient error -> fallback invoked
   - auth/policy error -> kein fallback

4. **Integration: bestehende Pipeline**
   - `fallbackCascade`-Pfad unverändert funktionsfähig mit mockbarem `LLMClient`

5. **Fail-closed Regression**
   - invalid env in `prod/staging/dry_run` verhindert Start

## 9. Rollout Recommendation

1. Contract/Resolver einführen (ohne Verhaltensänderung)
2. aktuellen xAI-Pfad hinter Adapter-Factory hängen
3. OpenAI-Adapter aktivieren
4. Anthropic-Adapter aktivieren
5. optionalen Fallback aktivieren
6. Tests + Env-Doku vervollständigen

## 10. Final Recommendation

Kein Overhaul: Das Repo hat bereits einen brauchbaren LLM-Port. Der beste Weg ist ein kleiner Refactor zu klaren Adaptern plus Resolver/Fallback-Wrapping. So bleiben Prompt-, Safety- und Pipeline-Schichten stabil, während OpenAI und Anthropic sauber und fail-closed ergänzt werden.
