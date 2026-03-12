# Runbook: Production-Proof Rollout & Rollback

## Übersicht

Dieses Runbook dokumentiert den sicheren Rollout und Rollback für xAi_Bot-App im Multi-Worker-Betrieb.

---

## Deployment Modes (Betriebsregel)

| Mode | Store | Multi-Worker | Verwendung |
|------|-------|--------------|------------|
| **Redis** | `USE_REDIS=true` + `KV_URL` | **Ja** | Production mit 2+ Instanzen. |
| **FileSystem** | Default (ohne Redis) | **Nein** | Lokal, Single-Instance nur. |

**Wichtig:** Multi-Worker Production ist **nur mit Redis** freigegeben. Der Distributed Poll-Lock (Single-Leader) nutzt Redis `SET NX EX`; ohne Redis gibt es kein verteiltes Locking. FileSystem = single-instance only — nicht für Multi-Worker einsetzen.

---

## Staged Rollout Discipline

### Phase 1: Canary (1 Worker)
- **Voraussetzung**: `USE_REDIS=true`, `KV_URL` gesetzt, `LAUNCH_MODE=staging` oder `dry_run`
- **Aktion**: Einzelner Worker mit `POLL_LOCK_ENABLED=true` (Default)
- **Dauer**: 24–48h
- **Prüfung**: Health `/health` healthy, `recent_poll_success` grün, keine Duplikate in Logs (`publish_duplicate_prevented_total`)

### Phase 2: Scale-up (2+ Workers)
- **Voraussetzung**: Canary stabil, Metriken unauffällig
- **Aktion**: Zusätzliche Worker starten (alle teilen dasselbe Redis)
- **Wichtig**: Nur ein Worker pollt gleichzeitig (Poll-Lock). Übrige warten (`[POLL] Not leader, waiting...`)
- **Prüfung**: `poll_lock_acquired_total` steigt bei Leader-Wechsel; `poll_lock_failed_total` für Follower

### Phase 3: Production
- **Aktion**: `LAUNCH_MODE=prod`, alle Worker auf Prod-Traffic
- **Monitoring**: Siehe [Metriken & Alerts](#metriken--alerts)

---

## Rollback

| Stufe | Aktion | Recovery |
|-------|--------|----------|
| **Soft** | `LAUNCH_MODE=dry_run` + Restart | Verhindert neue Posts, behält State |
| **Hard** | `LAUNCH_MODE=off` + Restart | Keine LLM-Aufrufe, nur Refusals |
| **Scale down** | Worker-Anzahl reduzieren | Weniger Last, Leader-Wechsel |
| **Critical** | Prozesse stoppen, vorheriges Image deployen | Vollständiger Rollback |

### Sofort-Rollback
```bash
# Alle Worker stoppen (graceful)
kill -TERM <pid>

# Oder: LAUNCH_MODE umstellen + Restart
LAUNCH_MODE=dry_run pnpm run poll
```

### Poll-Lock bei Shutdown
- Bei SIGTERM/SIGINT gibt der Leader den Lock frei (`releasePollLock`)
- Andere Worker können nach TTL- Ablauf (120s) übernehmen

---

## Metriken & Alerts

### Kern-Metriken

| Metrik | Bedeutung | Alert-Threshold |
|--------|-----------|-----------------|
| `poll_lock_acquired_total` | Worker hat Leader-Lock erhalten | — |
| `poll_lock_failed_total` | Worker konnte Lock nicht erwerben (erwartet bei 2+ Workers) | Spike > Baseline |
| `recent_poll_success` (Health) | Letzter Poll war erfolgreich | degraded/unhealthy |
| `state_store_error_total` | Redis/Store-Fehler | > 0 |
| `publish_duplicate_prevented_total` | Doppelposts verhindert | Anstieg prüfen (sollte bei sauberem Lauf niedrig sein) |
| `publish_failure_total` | Publish-Fehler | Anstieg |
| `recent_failure_streak` | Aufeinanderfolgende Fehler | ≥ 5 → unhealthy |

### poll_lock_failed_total — Normal vs auffällig

| Situation | Erwartung | Aktion |
|-----------|-----------|--------|
| **Normal** | Follower-Worker sehen Lock-Failures (nur Leader pollt). Bei N Workern: ca. (N−1) Failures pro Zyklus | Keine |
| **Auffällig** | Ungewöhnlich hoher Wert, starke Spikes | Prüfen: Zu viele Instanzen deployed? Falsche KV_URL (jeder Worker eigenes Redis)? Fehlkonfiguration bei Skalierung |

**Operations-Hinweis:** Ungewöhnlich hohe `poll_lock_failed_total` kann auf zu viele Worker-Instanzen oder falsches Deployment (z. B. jeder Pod eigenes Redis) hindeuten. Bei Verdacht: tatsächliche Worker-Anzahl und KV_URL-Konfiguration prüfen.

### Empfohlene Alerts
1. **Stale Worker**: `recent_poll_success` unhealthy > 10 Min
2. **Store Down**: `state_store_reachable` unhealthy
3. **Publish Spikes**: `publish_failure_total` Rate erhöht
4. **Backlog Stuck**: `recent_failure_streak` ≥ 5
5. **Poll-Lock Fehlkonfiguration**: `poll_lock_failed_total` stark über Baseline (z. B. > erwartet bei bekannter Worker-Anzahl)

---

## Cursor-Advance-Policy

| Frage | Antwort |
|-------|---------|
| **Wann bewegt sich der Cursor?** | Nur nach erfolgreichem Poll. `since_id` wird auf `maxId` (höchste ID der Batch) gesetzt — nachdem alle Mentions verarbeitet oder übersprungen wurden |
| **Crash zwischen Verarbeitung und Cursor-Update?** | Cursor bleibt unverändert. Nach Restart wird derselbe Bereich erneut gefetcht. Bereits veröffentlichte Mentions erkennt `isPublished` → kein Doppelpost |
| **Partial Failure (eine Mention schlägt fehl)?** | Cursor wird trotzdem fortgeschrieben. Fehlgeschlagene Mention bleibt in `event_state` (publish_attempted oder processed_ok); bei Restart ggf. Retry möglich |

**Zusammenhang mit Dedupe/Restart:** Der Cursor springt nie ohne vorherige Verarbeitung. Alle gesehenen Mentions sind in StateStore. Das garantiert: kein Event-Verlust, kein blindes Doppeln.

---

## Heartbeat / Stale Worker Detection

- **Key**: `worker:last_poll_success` in StateStore (TTL 10 Min)
- **Health-Check**: Liest Heartbeat, vergleicht mit `STALE_POLL_MS` (5 Min)
- **Interpretation**:
  - Kein Heartbeat → degraded (noch kein Poll oder Worker tot)
  - Heartbeat > 5 Min alt → unhealthy
  - Heartbeat < 5 Min → healthy

---

## Publish Lifecycle State Machine

```
event_seen → processed_ok → publish_attempted → publish_succeeded
                ↓                    ↓
         (recordMentionSkipped)  (retry bei Fehler)
```

- **Idempotenz**: `isPublished(eventId)` verhindert Doppelveröffentlichung
- **Lock**: `acquirePublishLock(eventId, 30s)` vor Publish-Versuch
- **Crash**: Lock läuft ab; anderer Worker kann übernehmen. `markPublished` erst nach erfolgreichem API-Call.

---

## Incident Checklist

- [ ] `LAUNCH_MODE=dry_run` oder `off` bei problematischen Replies
- [ ] Health-Check prüfen: `/health`
- [ ] Logs: `[POLL_LOCK]`, `[EVENT_STATE]`, `publish_duplicate_prevented`
- [ ] Redis erreichbar? `state_store_reachable`
- [ ] Mehrere Worker? Nur einer pollt; andere zeigen `[POLL] Not leader, waiting...`
- [ ] Cursor und State nach Restart intakt (kein Datenverlust)
