#!/usr/bin/env tsx
/**
 * Simuliert realistische Q&A-Abläufe (Reply + Multi-Turn).
 * Nutzt parent_text und conversation_context für Kontext-Treue.
 *
 * Usage:
 *   pnpm simulate                      # Built-in Szenarien
 *   pnpm simulate --file path/to.jsonl # Szenarien aus Datei
 *   pnpm simulate --strict             # Exit 1 bei Fehlschlag (CI-tauglich)
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { handleEvent } from "../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../src/canonical/types.js";
import { createXAILLMClient } from "../src/clients/llmClient.xai.js";
import { withCircuitBreaker } from "../src/ops/llmCircuitBreaker.js";
import { logError } from "../src/ops/logger.js";
import { createSimulatedCanonicalEvent } from "../tests/utils/testEventFactory.js";

interface ConversationTurn {
  userInput: string;
  expectedKeywords?: string[];
  description?: string;
  /** Wenn true: Turn nur als parent_text für nächsten Turn, Pipeline wird nicht aufgerufen */
  skipPipeline?: boolean;
}

interface ConversationScenario {
  name: string;
  turns: ConversationTurn[];
}

const BUILTIN_SCENARIOS: ConversationScenario[] = [
  {
    name: "reply-to-fake-alpha-claim",
    turns: [
      {
        userInput: "Massive insider alpha coming. Big things dropping soon.",
        description: "Parent-Tweet (simuliert vorherigen Post)",
        skipPipeline: true,
      },
      {
        userInput: "@GORKY_ON_SOL How many times do we hear this before something actually ships?",
        expectedKeywords: ["nothing", "vaporware", "cope", "ship"],
      },
    ],
  },
  {
    name: "multi-turn-market-panic",
    turns: [
      { userInput: "@GORKY_ON_SOL BTC -8%, CT sagt end of crypto. Cope oder real?" },
      {
        userInput: "@GORKY_ON_SOL ok aber was sagt die liquidation heatmap?",
        expectedKeywords: ["liquidation", "cascade", "leverage", "rekt"],
      },
      {
        userInput: "@GORKY_ON_SOL und wie siehts mit den whale wallets aus?",
        expectedKeywords: ["concentrated", "whale", "distribution", "exit"],
      },
    ],
  },
];

const DEFAULT_SCENARIOS_PATH = resolve(__dirname, "scenarios", "conversation_scenarios.jsonl");

function loadScenariosFromFile(filePath: string): ConversationScenario[] {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Szenarien-Datei nicht gefunden: ${resolved}`);
  }
  const content = readFileSync(resolved, "utf-8");
  const scenarios: ConversationScenario[] = [];
  for (const line of content.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as ConversationScenario;
      if (parsed.name && Array.isArray(parsed.turns)) {
        scenarios.push(parsed);
      }
    } catch (e) {
      console.warn(`[WARN] Ungültige Zeile übersprungen: ${trimmed.slice(0, 60)}...`);
    }
  }
  return scenarios.length > 0 ? scenarios : BUILTIN_SCENARIOS;
}

function parseArgs(): { file?: string; strict: boolean } {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const fileIdx = args.indexOf("--file");
  const file = fileIdx !== -1 && args[fileIdx + 1] ? args[fileIdx + 1] : undefined;
  return { file, strict };
}

interface RunResult {
  scenario: string;
  passed: boolean;
  failures: string[];
  turnsExecuted: number;
}

async function runScenario(
  scenario: ConversationScenario,
  deps: { llm: ReturnType<typeof withCircuitBreaker>; botUserId: string },
  strict: boolean,
): Promise<RunResult> {
  const failures: string[] = [];
  let turnsExecuted = 0;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 Simulation: ${scenario.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  let lastBotReply = "";
  let parentForNext: string | null = null;
  const conversationContext: string[] = [];

  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i];
    console.log(`Turn ${i + 1}${turn.description ? ` (${turn.description})` : ""}:`);
    console.log(`User: ${turn.userInput}`);

    if (turn.skipPipeline) {
      parentForNext = turn.userInput;
      console.log(`  → Nur Kontext, Pipeline übersprungen.\n`);
      continue;
    }

    const event = createSimulatedCanonicalEvent(turn.userInput, "@testuser", {
      parent_text: parentForNext ?? null,
      conversation_context: [...conversationContext],
      context: parentForNext ?? undefined,
    });

    try {
      const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

      if (result.action === "skip") {
        const msg = `Turn ${i + 1}: Pipeline skip (${result.skip_reason})`;
        failures.push(msg);
        console.log(`  [SKIP] ${result.skip_reason}\n`);
        if (strict) break;
        continue;
      }

      const replyText = result.reply_text ?? "";
      lastBotReply = replyText;
      parentForNext = replyText;
      conversationContext.push(`${event.author_handle}: ${event.text}`);
      conversationContext.push(`@GORKY_ON_SOL: ${replyText}`);
      turnsExecuted++;

      console.log(`Gorky: ${replyText}`);

      if (turn.expectedKeywords && turn.expectedKeywords.length > 0) {
        const found = turn.expectedKeywords.filter((kw) =>
          replyText.toLowerCase().includes(kw.toLowerCase()),
        );
        const missed = turn.expectedKeywords.filter(
          (kw) => !replyText.toLowerCase().includes(kw.toLowerCase()),
        );
        if (found.length > 0) {
          console.log(`  → Erwartete Keywords: ${found.join(", ")}`);
        }
        if (missed.length > 0) {
          const msg = `Turn ${i + 1}: Keywords fehlen: ${missed.join(", ")}`;
          failures.push(msg);
          console.log(`  → FEHLER: Keywords fehlen: ${missed.join(", ")}`);
        }
      }
      console.log("");
    } catch (err) {
      logError("Fehler in Turn", { turn: i + 1, scenario: scenario.name, error: err });
      failures.push(`Turn ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  return {
    scenario: scenario.name,
    passed: failures.length === 0,
    failures,
    turnsExecuted,
  };
}

async function main() {
  const { file, strict } = parseArgs();

  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("XAI_API_KEY oder OPENAI_API_KEY nicht gesetzt. Simulation erfordert LLM-API.");
    process.exit(1);
  }

  const scenarios = file ? loadScenariosFromFile(file) : existsSync(DEFAULT_SCENARIOS_PATH)
    ? loadScenariosFromFile(DEFAULT_SCENARIOS_PATH)
    : BUILTIN_SCENARIOS;

  if (file) {
    console.log(`Szenarien geladen von: ${resolve(process.cwd(), file)}\n`);
  }

  const llmClient = withCircuitBreaker(createXAILLMClient());
  const deps = { llm: llmClient, botUserId: "sim-bot-1" };

  const results: RunResult[] = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario, deps, strict);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const totalFailures = results.flatMap((r) => r.failures).length;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Zusammenfassung");
  console.log(`   Bestanden: ${passed}/${results.length}`);
  if (failed.length > 0) {
    console.log(`   Fehlgeschlagen: ${failed.map((r) => r.scenario).join(", ")}`);
    for (const r of failed) {
      for (const f of r.failures) console.log(`     - ${f}`);
    }
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (strict && totalFailures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Simulation fehlgeschlagen:", err);
  process.exit(1);
});
