/**
 * Daily Snippet Extractor — Cron-Job für Persona Memory Snippets
 * Liest Audit-Log, filtert nach relevance, extrahiert Roast-Muster via LLM, speichert in Redis.
 *
 * Usage: pnpm exec tsx src/persona/dailySnippetExtractor.ts
 * Render Cron: täglich 3 Uhr UTC
 */
import "dotenv/config";
import { getRecentAuditEntries } from "../canonical/auditTail.js";
import type { AuditRecord } from "../canonical/types.js";
import { addOrUpdateSnippets } from "./memorySnippets.js";
import { createXAILLMClient } from "../clients/llmClient.xai.js";
import { withCircuitBreaker } from "../ops/llmCircuitBreaker.js";
import { logInfo, logWarn } from "../ops/logger.js";

const RELEVANCE_MIN = 0.75;
const AUDIT_LIMIT = 120;
const MIN_ENTRIES_FOR_EXTRACTION = 10;

const EXTRACTION_SYSTEM = `Du bist ein Analyse-Assistent. Extrahiere aus den gegebenen Mention-Antworten-Paaren maximal 3 kurze, allgemeine Roast-Muster oder typische CT-Verhaltensweisen.
Regeln: Nur wiederkehrende Muster, keine user-spezifischen Inhalte, keine persönlichen Daten, prägnant und meme-kompatibel formuliert.`;

const EXTRACTION_DEVELOPER = `Antworte ausschließlich mit einem JSON-Array von Strings. Jeder String ist ein Snippet (max 80 Zeichen). Beispiel: ["Bei jedem 'early alpha' Post landet der Roast bei 'exit liquidity'.", "Solana-Mentions triggern oft 'VC chain' oder 'centralized speed'."]`;


async function runDailySnippetExtraction(): Promise<void> {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logWarn("[SnippetExtractor] XAI_API_KEY nicht gesetzt, überspringe Extraktion");
    return;
  }

  const recent = await getRecentAuditEntries(AUDIT_LIMIT);
  if (recent.length < MIN_ENTRIES_FOR_EXTRACTION) {
    logInfo("[SnippetExtractor] Zu wenige Einträge", {
      count: recent.length,
      min: MIN_ENTRIES_FOR_EXTRACTION,
    });
    return;
  }

  // Proxy für Bissigkeit (bissigkeit_score noch nicht im Audit) — reply Länge + Meme-Keywords
  const BISSIGKEIT_PROXY = {
    minReplyLength: 60,
    memeKeywords: ["cope", "ngmi", "rekt", "wagmi", "ser", "vibe", "narrative", "narrativ"],
  };
  let filtered = recent.filter(
    (r) =>
      (r.score_bundle?.relevance ?? 0) > RELEVANCE_MIN &&
      (r.reply_text?.length ?? 0) > BISSIGKEIT_PROXY.minReplyLength &&
      BISSIGKEIT_PROXY.memeKeywords.some(
        (kw) => r.reply_text?.toLowerCase().includes(kw),
      ),
  );
  if (filtered.length < 5) {
    filtered = recent.filter(
      (r) =>
        (r.score_bundle?.relevance ?? 0) > RELEVANCE_MIN &&
        (r.reply_text?.length ?? 0) > BISSIGKEIT_PROXY.minReplyLength,
    );
  }

  if (filtered.length < 5) {
    logInfo("[SnippetExtractor] Zu wenige hoch-relevante Einträge", {
      filtered: filtered.length,
    });
    return;
  }

  const mentionsText = filtered
    .map((r) => {
      const text = r.event_text ?? r.event_id;
      const reply = r.reply_text ?? "(keine Antwort)";
      return `${text}\n→ ${reply}`;
    })
    .join("\n---\n");

  const userPrompt = `Mentions der letzten Tage (User → Gorky-Antwort):\n\n${mentionsText}\n\nExtrahiere maximal 3 neue Snippets als JSON-Array von Strings.`;

  const llm = withCircuitBreaker(createXAILLMClient());
  try {
    const raw = await llm.generateJSON<unknown>({
      system: EXTRACTION_SYSTEM,
      developer: EXTRACTION_DEVELOPER,
      user: userPrompt,
      temperature: 0.5,
      max_tokens: 400,
      schemaHint: '["string"]',
    });

    let snippets: string[] = [];
    if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) {
      snippets = raw.map((s) => String(s).trim()).filter(Boolean);
    } else if (
      raw &&
      typeof raw === "object" &&
      "snippets" in raw &&
      Array.isArray((raw as { snippets: unknown }).snippets)
    ) {
      snippets = (raw as { snippets: string[] }).snippets
        .map((s) => String(s).trim())
        .filter(Boolean);
    }

    const validSnippets = snippets.filter(
      (s) =>
        s.length > 20 &&
        s.length < 120 &&
        !s.toLowerCase().includes("user") &&
        !s.includes("@"),
    );

    if (validSnippets.length > 0) {
      await addOrUpdateSnippets(validSnippets);
      logInfo("[SnippetExtractor] Snippets extrahiert und gespeichert", {
        count: validSnippets.length,
      });
    } else {
      logWarn(
        "[SnippetExtractor] Keine neuen Persona-Snippets generiert – möglicherweise zu wenig Daten oder Filter durchgelaufen",
        { rawCount: snippets.length, raw },
      );
    }
  } catch (err) {
    logWarn("[SnippetExtractor] Extraktion fehlgeschlagen", { err });
    throw err;
  }
}

async function main(): Promise<void> {
  await runDailySnippetExtraction();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[SnippetExtractor] Fatal:", err);
    process.exit(1);
  });
