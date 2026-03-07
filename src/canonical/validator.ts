import { checkPublicTextSafe } from "../boundary/publicTextGuard.js";
import { enforcePersonaGuardrails } from "../persona/personaGuardrails.js";
import type {
  CanonicalMode,
  CanonicalConfig,
  ClassifierOutput,
  ValidationResult,
  ValidationCheck,
  RepairSuggestion,
} from "./types.js";
import { getHardMax } from "./modeBudgets.js";

const WALLET_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const URL_RE = /https?:\/\/\S+/i;
const FA_PATTERNS = [
  /\b(?:buy|sell|trade|invest|short|long)\s+(?:now|this|it|immediately)\b/i,
  /\b(?:financial\s+advice|not\s+financial\s+advice|nfa)\b/i,
  /\b(?:guaranteed\s+(?:return|profit|gain))\b/i,
  /\b(?:you\s+should\s+(?:buy|sell|invest|trade))\b/i,
];

function checkCharLimit(text: string, mode: CanonicalMode): boolean {
  const max = getHardMax(mode);
  return max === 0 || text.length <= max;
}

function checkIdentityAttack(text: string): boolean {
  const result = checkPublicTextSafe(text);
  return result.safe;
}

function checkFinancialAdvice(text: string): boolean {
  return !FA_PATTERNS.some((p) => p.test(text));
}

function checkWalletFilter(text: string, config: CanonicalConfig): boolean {
  if (config.safety.allow_wallet_addresses) return true;
  return !WALLET_RE.test(text);
}

function checkUnsupportedAssertion(
  text: string,
  _cls: ClassifierOutput,
): boolean {
  const fabricationPatterns = [
    /\b(?:sources\s+confirm|reports\s+indicate|according\s+to\s+(?:our|my)\s+(?:data|research))\b/i,
    /\b(?:it\s+has\s+been\s+(?:confirmed|verified|proven))\b/i,
  ];
  return !fabricationPatterns.some((p) => p.test(text));
}

function checkModeMatch(text: string, mode: CanonicalMode): boolean {
  if (mode === "dry_one_liner") {
    return text.split(/[.!?]\s/).length <= 3;
  }
  return true;
}

function checkPersonaCompliance(text: string): boolean {
  const guardrailResult = enforcePersonaGuardrails(text, {
    hasVerifiedData: false,
  });
  return guardrailResult.passed;
}

function checkLinks(text: string, config: CanonicalConfig): boolean {
  if (config.safety.allow_raw_links) return true;
  return !URL_RE.test(text);
}

export function validateResponse(
  text: string,
  mode: CanonicalMode,
  cls: ClassifierOutput,
  config: CanonicalConfig,
): ValidationResult {
  if (!text || !text.trim()) {
    return {
      ok: false,
      reason: "empty_output",
      checks: allFalse(),
    };
  }

  const checks: ValidationCheck = {
    char_limit: checkCharLimit(text, mode),
    identity_attack: checkIdentityAttack(text),
    financial_advice: checkFinancialAdvice(text),
    wallet_filter: checkWalletFilter(text, config),
    unsupported_assertion: checkUnsupportedAssertion(text, cls),
    mode_match: checkModeMatch(text, mode),
    persona_compliance: checkPersonaCompliance(text),
  };

  if (!checkLinks(text, config)) {
    return { ok: false, reason: "raw_link_present", checks };
  }

  const REPAIR_MAP: Partial<Record<string, RepairSuggestion>> = {
    char_limit: "shorten",
    mode_match: "swap_closer",
    persona_compliance: "neutralize",
    identity_attack: "neutralize",
  };

  for (const [key, passed] of Object.entries(checks)) {
    if (!passed) {
      const repair = REPAIR_MAP[key];
      return {
        ok: false,
        reason: key,
        checks,
        repair_suggested: repair,
      };
    }
  }

  return { ok: true, reason: "passed", checks };
}

function allFalse(): ValidationCheck {
  return {
    char_limit: false,
    identity_attack: false,
    financial_advice: false,
    wallet_filter: false,
    unsupported_assertion: false,
    mode_match: false,
    persona_compliance: false,
  };
}
