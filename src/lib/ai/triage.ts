import type { TriageAction, TriageRule, TriageSeverity } from "./industry-packs";

/**
 * Deterministic red-flag screening.
 *
 * This runs on the patient's inbound message *before* the language model is
 * called, and its result overrides whatever the model wanted to do. That
 * ordering is the whole point: "is this a urological emergency" is not a
 * question to put to a sampled token stream, and a clinic's medical director
 * cannot sign off on a probability. It is a fixed, reviewable list of
 * phrases and patterns evaluated by ordinary string matching, with a test
 * suite that pins the behaviour.
 *
 * The module is deliberately generic — it takes rules as an argument and
 * imports nothing at runtime — so the same engine screens men's health,
 * aesthetics and elderly-care messages, and can be unit tested without a
 * database, a network or an API key.
 */

export interface ScreenResult {
  /** True when at least one rule fired. */
  matched: boolean;
  /** The highest-severity match, which is the one that governs the reply. */
  rule: TriageRule | null;
  severity: TriageSeverity | null;
  action: TriageAction | null;
  /** The reply the agent must send instead of continuing to book. */
  response: string;
  /** Every rule that fired, most severe first — for the audit trail, not
   * just the one that decided the outcome. */
  allMatches: TriageRule[];
  /** How the deciding rule matched, for logs. */
  matchedBy: "phrase" | "pattern" | "none";
  /** The exact phrase or pattern that tripped it. */
  matchedText: string;
}

const NO_MATCH: ScreenResult = {
  matched: false,
  rule: null,
  severity: null,
  action: null,
  response: "",
  allMatches: [],
  matchedBy: "none",
  matchedText: "",
};

/**
 * Words that invert a symptom. Screened per-phrase against the few words
 * immediately before the match, so "no chest pain" doesn't fire the chest
 * pain rule while "no chest pain but I can't breathe" still fires the
 * breathing one.
 */
const NEGATIONS = new Set(["no", "not", "never", "denies", "denied", "without", "negative", "isnt", "isn't", "dont", "don't", "doesnt", "doesn't", "havent", "haven't", "arent", "aren't", "wasnt", "wasn't"]);

/** How many characters before a match to inspect for a negation. */
const NEGATION_WINDOW = 24;

const SEVERITY_RANK: Record<TriageSeverity, number> = { emergency: 3, urgent: 2, caution: 1 };

/**
 * Folds away the variations that don't change meaning but do break naive
 * substring matching: case, curly apostrophes, non-breaking spaces, and
 * repeated whitespace. Punctuation is preserved — patterns use sentence
 * boundaries.
 */
export function normalizeForScreening(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  const words = before.split(/[^a-z']+/).filter(Boolean).slice(-3);
  return words.some((w) => NEGATIONS.has(w));
}

function phraseMatches(normalized: string, rule: TriageRule): { hit: boolean; text: string } {
  for (const phrase of rule.phrases) {
    const needle = normalizeForScreening(phrase);
    if (!needle) continue;
    let from = 0;
    for (;;) {
      const index = normalized.indexOf(needle, from);
      if (index === -1) break;
      if (!isNegated(normalized, index)) return { hit: true, text: phrase };
      from = index + needle.length;
    }
  }
  return { hit: false, text: "" };
}

function patternMatches(normalized: string, rule: TriageRule): { hit: boolean; text: string } {
  for (const source of rule.patterns ?? []) {
    try {
      const re = new RegExp(source, "i");
      if (re.test(normalized)) return { hit: true, text: source };
    } catch {
      // A malformed pattern in a pack must never break screening for every
      // other rule — skip it and keep evaluating.
    }
  }
  return { hit: false, text: "" };
}

/**
 * Screens one inbound message. Returns the most severe match, or a
 * non-matching result. `enabled: false` (a clinic that has turned triage off)
 * returns no match — an explicit, auditable switch rather than silent
 * behaviour.
 */
export function screenMessage(
  text: string,
  rules: TriageRule[],
  opts: { enabled?: boolean } = {},
): ScreenResult {
  if (opts.enabled === false) return NO_MATCH;
  const normalized = normalizeForScreening(text ?? "");
  if (!normalized) return NO_MATCH;

  const matches: Array<{ rule: TriageRule; by: "phrase" | "pattern"; text: string }> = [];
  for (const rule of rules) {
    const phrase = phraseMatches(normalized, rule);
    if (phrase.hit) {
      matches.push({ rule, by: "phrase", text: phrase.text });
      continue;
    }
    const pattern = patternMatches(normalized, rule);
    if (pattern.hit) matches.push({ rule, by: "pattern", text: pattern.text });
  }

  if (matches.length === 0) return NO_MATCH;

  // Stable sort by severity, so equal-severity ties keep the pack's own
  // order — the pack lists its most serious rules first deliberately.
  const ranked = matches
    .map((m, index) => ({ ...m, index }))
    .sort((a, b) => SEVERITY_RANK[b.rule.severity] - SEVERITY_RANK[a.rule.severity] || a.index - b.index);

  const deciding = ranked[0];
  return {
    matched: true,
    rule: deciding.rule,
    severity: deciding.rule.severity,
    action: deciding.rule.action,
    response: deciding.rule.response,
    allMatches: ranked.map((m) => m.rule),
    matchedBy: deciding.by,
    matchedText: deciding.text,
  };
}

/** Emergency and urgent are both "a human takes over now". Caution means the
 * chat may continue but the session is flagged for clinical review. */
export function requiresHandoff(severity: TriageSeverity | null): boolean {
  return severity === "emergency" || severity === "urgent";
}

/** True for the one severity that tells the patient to seek emergency care
 * themselves, rather than waiting for the clinic to call back. */
export function requiresEmergencyServices(severity: TriageSeverity | null): boolean {
  return severity === "emergency";
}
