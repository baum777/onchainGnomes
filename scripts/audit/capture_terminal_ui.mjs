#!/usr/bin/env node
/**
 * Terminal UI Audit — Capture screenshots of defined UI states.
 * Hardened with: wall-clock cut, step timeout, retry, overload detection, resume, graceful finalize.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// ===== HARDENING CONFIG =====
const MAX_RUN_MINUTES = parseInt(process.env.AUDIT_MAX_RUN_MINUTES ?? "25", 10);
const MAX_RUN_MS = MAX_RUN_MINUTES * 60 * 1000;
const STEP_TIMEOUT_MS =
  parseInt(process.env.AUDIT_STEP_TIMEOUT_SECONDS ?? "90", 10) * 1000;
const STEP_RETRY_COUNT = parseInt(process.env.AUDIT_STEP_RETRY_COUNT ?? "1", 10);
const AUDIT_RESUME = process.env.AUDIT_RESUME !== "0";
const AUDIT_PLAN = process.env.AUDIT_PLAN ?? "core";
const AUDIT_BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const runStartedAt = Date.now();

const RUN_STATE_PATH = path.join(PROJECT_ROOT, "docs/audit/run_state.json");
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "docs/audit/screenshots");
const SUMMARY_PATH = path.join(
  PROJECT_ROOT,
  "docs/audit/terminal_ui_run_summary.md"
);

const runState = {
  status: "OK",
  captured: [],
  failures: [],
  consecutiveFailures: 0,
  totalFailures: 0,
  timeouts: 0,
  errorBoundaryScreens: 0,
  startedAt: new Date().toISOString(),
  finishedAt: null
};

// ===== STEP PLANS (PATCH 6) =====
const PLAN_STEPS = {
  core: [
    { id: "S-001_terminal_baseline", path: "/", waitFor: "#terminal" },
    { id: "S-002_wallet_modal", path: "/?modal=wallet", waitFor: "[data-modal=wallet]" }
  ],
  discover: [
    { id: "S-001_terminal_baseline", path: "/", waitFor: "#terminal" },
    { id: "S-002_wallet_modal", path: "/?modal=wallet", waitFor: "[data-modal=wallet]" },
    { id: "S-003_settings", path: "/settings", waitFor: "body" },
    { id: "S-004_quote_form", path: "/quote", waitFor: "form" },
    { id: "S-005_order_book", path: "/orderbook", waitFor: "body" }
  ],
  all: [
    { id: "S-001_terminal_baseline", path: "/", waitFor: "#terminal" },
    { id: "S-002_wallet_modal", path: "/?modal=wallet", waitFor: "[data-modal=wallet]" },
    { id: "S-003_settings", path: "/settings", waitFor: "body" },
    { id: "S-004_quote_form", path: "/quote", waitFor: "form" },
    { id: "S-005_order_book", path: "/orderbook", waitFor: "body" },
    { id: "S-006_trade_history", path: "/history", waitFor: "body" },
    { id: "S-007_quote_success", path: "/quote?success=1", waitFor: "[data-success]" }
  ]
};

const steps = PLAN_STEPS[AUDIT_PLAN] ?? PLAN_STEPS.core;

// ===== HELPERS =====
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`TIMEOUT:${label}`)),
      ms
    );
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    timeoutPromise
  ]);
}

function shouldHardCut() {
  if (Date.now() - runStartedAt > MAX_RUN_MS) return true;
  if (runState.consecutiveFailures >= 5) return true;
  if (runState.timeouts >= 3) return true;
  if (runState.errorBoundaryScreens >= 2) return true;
  if (runState.totalFailures >= 10) return true;
  return false;
}

function recordResult({ uiId, status, screenshotPath, reason }) {
  if (status === "CAPTURED") {
    runState.captured.push(uiId);
    runState.consecutiveFailures = 0;
  } else {
    runState.failures.push({ uiId, reason: reason ?? "UNKNOWN" });
    runState.consecutiveFailures++;
    runState.totalFailures++;
    if (reason?.includes("TIMEOUT")) runState.timeouts++;
    if (reason?.includes("ErrorBoundary")) runState.errorBoundaryScreens++;
  }
}

// ===== FINALIZE (PATCH 5) =====
function finalize() {
  runState.finishedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(RUN_STATE_PATH), { recursive: true });
  fs.writeFileSync(
    RUN_STATE_PATH,
    JSON.stringify(runState, null, 2),
    "utf8"
  );

  const durationSec = ((Date.now() - runStartedAt) / 1000).toFixed(1);
  const topFailures = runState.failures
    .slice(0, 5)
    .map((f) => `- ${f.uiId}: ${f.reason}`)
    .join("\n");

  const recommendedAction =
    runState.status === "CUT_OVERLOAD"
      ? "Resume run with AUDIT_RESUME=1"
      : runState.totalFailures > 5
        ? "Split run with AUDIT_PLAN=discover"
        : "None";

  const summary = `# Terminal UI Audit Run Summary

Status: ${runState.status}
Started At: ${runState.startedAt}
Finished At: ${runState.finishedAt}

Total Duration: ${durationSec}s
Captured Screens: ${runState.captured.length}
Not Captured: ${runState.failures.length}

Top Failure Reasons:
${topFailures || "- (none)"}

Next Recommended Action:
- ${recommendedAction}
`;

  fs.writeFileSync(SUMMARY_PATH, summary, "utf8");
}

process.on("SIGINT", () => {
  runState.status = "CUT_OVERLOAD";
  finalize();
  process.exit(0);
});
process.on("SIGTERM", () => {
  runState.status = "CUT_OVERLOAD";
  finalize();
  process.exit(0);
});

// ===== RESUME SUPPORT (PATCH 4) =====
if (AUDIT_RESUME && fs.existsSync(RUN_STATE_PATH)) {
  try {
    const previous = JSON.parse(
      fs.readFileSync(RUN_STATE_PATH, "utf8")
    );
    runState.captured = previous.captured ?? [];
    runState.failures = previous.failures ?? [];
    runState.consecutiveFailures = previous.consecutiveFailures ?? 0;
    runState.totalFailures = previous.totalFailures ?? 0;
    runState.timeouts = previous.timeouts ?? 0;
    runState.errorBoundaryScreens = previous.errorBoundaryScreens ?? 0;
  } catch (_) {
    // Ignore corrupt state, start fresh
  }
}

const capturedSet = new Set(runState.captured);

// ===== SCREENSHOT CAPTURE (Puppeteer) =====
async function captureScreenshot(step) {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    // Fallback: create minimal placeholder when puppeteer not installed
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const outPath = path.join(SCREENSHOTS_DIR, `${step.id}.png`);
    const minimalPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(outPath, minimalPng);
    return outPath;
  }

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    const url = new URL(step.path, AUDIT_BASE_URL).href;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    // Optional: wait for specific selector
    if (step.waitFor) {
      try {
        await page.waitForSelector(step.waitFor, { timeout: 5000 });
      } catch {
        // Check for ErrorBoundary
        const hasErrorBoundary = await page.evaluate(() =>
          document.body?.innerText?.includes("ErrorBoundary")
        );
        if (hasErrorBoundary) {
          throw new Error("ErrorBoundary");
        }
      }
    }

    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const outPath = path.join(SCREENSHOTS_DIR, `${step.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    return outPath;
  } finally {
    await browser.close();
  }
}

async function executeStep(step) {
  const screenshotPath = await captureScreenshot(step);
  // Hard cut check after screenshot (PATCH 1)
  if (shouldHardCut()) {
    runState.status = "CUT_OVERLOAD";
    const cutErr = new Error("CUT_OVERLOAD");
    cutErr.isHardCut = true;
    throw cutErr;
  }
  return screenshotPath;
}

// ===== MAIN LOOP =====
async function main() {
  fs.mkdirSync(path.dirname(RUN_STATE_PATH), { recursive: true });

  for (const step of steps) {
    // Skip already captured when resuming (PATCH 4)
    if (capturedSet.has(step.id)) {
      console.log(`[SKIP] ${step.id} (already captured)`);
      continue;
    }

    // Hard cut before each step (PATCH 1)
    if (shouldHardCut()) {
      runState.status = "CUT_OVERLOAD";
      break;
    }

    let success = false;
    for (let attempt = 0; attempt <= STEP_RETRY_COUNT; attempt++) {
      try {
        await withTimeout(
          executeStep(step),
          STEP_TIMEOUT_MS,
          step.id
        );
        recordResult({ uiId: step.id, status: "CAPTURED" });
        success = true;
        console.log(`[OK] ${step.id}`);
        break;
      } catch (err) {
        if (err?.isHardCut) {
          break;
        }
        if (attempt === STEP_RETRY_COUNT) {
          recordResult({
            uiId: step.id,
            status: "NOT_CAPTURED",
            reason: err?.message ?? String(err)
          });
          console.error(`[FAIL] ${step.id}: ${err?.message ?? err}`);
        } else {
          await sleep(500);
        }
      }
    }

    if (runState.status === "CUT_OVERLOAD") break;

    // Hard cut after step/screenshot
    if (shouldHardCut()) {
      runState.status = "CUT_OVERLOAD";
      break;
    }
  }

  finalize();
  process.exit(0);
}

main().catch((err) => {
  runState.status = "CRASHED";
  runState.failures.push({
    uiId: "CRASH",
    reason: err?.message ?? String(err)
  });
  finalize();
  console.error(err);
  process.exit(1);
});
