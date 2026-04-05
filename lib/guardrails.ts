/**
 * lib/guardrails.ts
 * Task 5 — Child safety guardrails (Section 8)
 *
 * Three exports:
 *  1. sanitizeInputs()  — Section 8.2: sanitize student data before prompt assembly
 *  2. validateResponse() — Section 8.3: validate Claude response before client delivery
 *  3. getFallbackQuestion() — Section 8.7: serve hardcoded safe question when retries exhausted
 *
 * Import only in server-side code (API routes, lib/claude.ts).
 * Never expose this module to the browser.
 */

import fallbackQuestions from "./fallback-questions.json";
import { INTEREST_TAGS } from "./constants/interest-tags";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaudeQuestionResponse {
  question: string;
  choices?: string[];             // multiple_choice only — ["A) ...", "B) ...", "C) ...", "D) ..."]
  correct_answer: string;
  explanation: string;
  difficulty_delivered: number;
  format: string;
  question_hash: string;
  [key: string]: unknown; // allow extra keys before stripping
}

export type ValidationResult =
  | { ok: true; data: ClaudeQuestionResponse }
  | { ok: false; reason: "retry" | "fallback"; detail: string };

export interface SanitizedInputs {
  name: string;
  interests: string[];
  recent_wrong_concepts: string;
}

export interface FallbackQuestion {
  question: string;
  correct_answer: string;
  format: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8.4 — Content blocklist (minimum, case-insensitive)
// Primary defence is the system prompt; this is a safety net for edge cases.
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKLIST: RegExp[] = [
  // Violence / self-harm
  /\b(kill|murder|suicide|self.harm|weapon|gun|knife|bomb|shoot|stab)\b/i,
  // Adult content
  /\b(sex|porn|naked|nude|breast|penis|vagina|condom|orgasm)\b/i,
  // Substances
  /\b(alcohol|beer|wine|vodka|drunk|drug|cocaine|heroin|marijuana|weed)\b/i,
  // Hate / extremism
  /\b(racist|terrorism|terrorist|nazi|hate speech)\b/i,
  // Prompt injection bypass attempts
  /ignore (previous|all|the|your) (instructions?|rules?|prompt)/i,
];

function hitsBlocklist(text: string): boolean {
  return BLOCKLIST.some((re) => re.test(text));
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8.2 — Prompt input sanitizer
// ─────────────────────────────────────────────────────────────────────────────

const VALID_INTEREST_TAGS = new Set<string>(INTEREST_TAGS);

/**
 * Sanitize all student-supplied fields before they enter a Claude prompt.
 * Throws if name is empty after stripping (caller must catch and abort).
 */
export function sanitizeInputs(raw: {
  name: string;
  interests: string[];
  recent_wrong_concepts?: string;
}): SanitizedInputs {
  // Name: alphanumeric + spaces only, max 30 chars
  const name = raw.name.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30).trim();
  if (!name) throw new Error("name is empty after sanitization");

  // Interests: must be on whitelist, max 10, each ≤ 20 chars
  const interests = raw.interests
    .filter((t) => typeof t === "string" && VALID_INTEREST_TAGS.has(t) && t.length <= 20)
    .slice(0, 10);

  // recent_wrong_concepts: plain text, max 200 chars total
  const recent_wrong_concepts = (raw.recent_wrong_concepts ?? "")
    .replace(/[<>'"]/g, "") // strip basic HTML/injection chars
    .slice(0, 200)
    .trim();

  return { name, interests, recent_wrong_concepts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8.3 — Response validator
// Runs all 8 checks in order. Returns ok:true with cleaned data, or ok:false
// with reason "retry" (try again) or "fallback" (serve hardcoded question).
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_KEYS = new Set([
  "question",
  "choices",
  "correct_answer",
  "explanation",
  "difficulty_delivered",
  "format",
  "question_hash",
]);

const FIELD_MAX_LENGTHS: Partial<Record<keyof ClaudeQuestionResponse, number>> = {
  question: 800,
  correct_answer: 200,
  explanation: 400,
};

export function validateResponse(
  raw: unknown,
  requestedFormat: string
): ValidationResult {
  // ── Check 1: valid JSON object ────────────────────────────────────────────
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "retry", detail: "response is not a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  // ── Check 8: error sentinel ───────────────────────────────────────────────
  // Check early so we don't retry on an intentional Claude refusal
  if (
    Object.keys(obj).length === 1 &&
    obj["error"] === "unable_to_generate"
  ) {
    return { ok: false, reason: "fallback", detail: "Claude returned unable_to_generate" };
  }

  // ── Check 2: required fields present ─────────────────────────────────────
  const required: Array<keyof ClaudeQuestionResponse> = [
    "question", "correct_answer", "explanation",
    "difficulty_delivered", "format", "question_hash",
  ];
  for (const field of required) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      return { ok: false, reason: "retry", detail: `missing required field: ${field}` };
    }
  }

  // ── Check 3: strip unexpected keys silently ───────────────────────────────
  const cleaned: Record<string, unknown> = {};
  Array.from(ALLOWED_KEYS).forEach((key) => {
    cleaned[key] = obj[key];
  });

  // ── Check 4: field length limits (truncate + log) ─────────────────────────
  Object.entries(FIELD_MAX_LENGTHS).forEach(([field, maxLen]) => {
    if (maxLen === undefined) return;
    const val = cleaned[field];
    if (typeof val === "string" && val.length > maxLen) {
      console.warn(`[guardrails] truncating ${field} from ${val.length} to ${maxLen} chars`);
      cleaned[field] = val.slice(0, maxLen);
    }
  });

  // Ensure string fields are strings
  for (const field of ["question", "correct_answer", "explanation", "format", "question_hash"]) {
    if (typeof cleaned[field] !== "string") {
      return { ok: false, reason: "retry", detail: `${field} must be a string` };
    }
  }

  // ── Check 5: format matches request ──────────────────────────────────────
  if (cleaned["format"] !== requestedFormat) {
    return {
      ok: false,
      reason: "retry",
      detail: `format mismatch: got "${cleaned["format"]}", expected "${requestedFormat}"`,
    };
  }

  // ── Check 6: difficulty_delivered integer 1–10 (clamp silently) ──────────
  let difficulty = Number(cleaned["difficulty_delivered"]);
  if (!Number.isFinite(difficulty)) {
    return { ok: false, reason: "retry", detail: "difficulty_delivered is not a number" };
  }
  difficulty = Math.round(Math.max(1, Math.min(10, difficulty)));
  cleaned["difficulty_delivered"] = difficulty;

  // ── Check 7: content blocklist on question + explanation ──────────────────
  const textToScan = `${cleaned["question"]} ${cleaned["explanation"]}`;
  if (hitsBlocklist(textToScan)) {
    // Do NOT log the content — Section 8.6
    console.warn("[guardrails] blocklist hit — discarding response");
    return { ok: false, reason: "retry", detail: "blocklist hit" };
  }

  return { ok: true, data: cleaned as unknown as ClaudeQuestionResponse };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8.7 — Fallback question bank
// Served when guardrail retries exhausted. Bypasses Claude entirely.
// ─────────────────────────────────────────────────────────────────────────────

type GradeBand = "grade_1_2" | "grade_3_4" | "grade_5_6" | "grade_7_8";

function gradeBand(grade: number): GradeBand {
  if (grade <= 2) return "grade_1_2";
  if (grade <= 4) return "grade_3_4";
  if (grade <= 6) return "grade_5_6";
  return "grade_7_8";
}

/**
 * Returns a random safe fallback question for the given grade.
 * Never throws — if JSON is malformed, returns a hardcoded last-resort question.
 */
export function getFallbackQuestion(grade: number): FallbackQuestion {
  try {
    const band = gradeBand(grade);
    const pool = (fallbackQuestions as Record<GradeBand, FallbackQuestion[]>)[band];
    if (!pool?.length) throw new Error("empty pool");
    return pool[Math.floor(Math.random() * pool.length)];
  } catch {
    return { question: "What is 5 + 5?", correct_answer: "10", format: "fill_blank_numeric" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation call guardrails (Section 8.5)
// For word_problem answer validation — second Claude call must return only
// {"correct": bool, "explanation": string}. Reject anything else.
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationCallResponse {
  correct: boolean;
  explanation: string;
}

export function validateValidationCallResponse(
  raw: unknown
): { ok: true; data: ValidationCallResponse } | { ok: false; detail: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, detail: "not a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj["correct"] !== "boolean") {
    return { ok: false, detail: "correct must be a boolean" };
  }
  if (typeof obj["explanation"] !== "string") {
    return { ok: false, detail: "explanation must be a string" };
  }

  // Reject any extra keys
  const keys = Object.keys(obj);
  if (keys.length !== 2 || !keys.includes("correct") || !keys.includes("explanation")) {
    return { ok: false, detail: "unexpected keys in validation response" };
  }

  // Blocklist scan on explanation
  if (hitsBlocklist(obj["explanation"] as string)) {
    console.warn("[guardrails] blocklist hit in validation explanation");
    return { ok: false, detail: "blocklist hit in explanation" };
  }

  return {
    ok: true,
    data: {
      correct: obj["correct"] as boolean,
      explanation: (obj["explanation"] as string).slice(0, 400),
    },
  };
}
