/**
 * lib/mastery.ts
 * Task 7 — Adaptive difficulty + XP logic (Section 2.4)
 *
 * TypeScript mirror of the adaptive difficulty rules.
 * Postgres function compute_topic_score() is the single source of truth
 * for confidence_score — this module only computes the *next* difficulty
 * offset and XP delta to return to the client.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants (Section 2.4)
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_OFFSET_MIN = -2;
const DIFFICULTY_OFFSET_MAX = 4;
const OFFSET_ON_CORRECT = 0.5;
const OFFSET_ON_INCORRECT = -1.0;

// XP values
const XP_CORRECT = 10;
const XP_INCORRECT = 2;       // participation XP — never zero
const XP_MASTERY_BONUS = 50;  // awarded when mastery_status flips to "mastered"

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty offset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the new difficulty offset after an attempt.
 * Clamped to [DIFFICULTY_OFFSET_MIN, DIFFICULTY_OFFSET_MAX].
 */
export function nextDifficultyOffset(
  currentOffset: number,
  isCorrect: boolean
): number {
  const delta = isCorrect ? OFFSET_ON_CORRECT : OFFSET_ON_INCORRECT;
  const next = currentOffset + delta;
  return Math.max(DIFFICULTY_OFFSET_MIN, Math.min(DIFFICULTY_OFFSET_MAX, next));
}

/**
 * Convert a grade + offset to an effective difficulty on the 1–10 scale.
 * Grade maps to a base difficulty (grade × 1.0), offset shifts it.
 */
export function effectiveDifficulty(grade: number, offset: number): number {
  const base = Math.max(1, Math.min(10, grade));
  return Math.max(1, Math.min(10, Math.round(base + offset)));
}

// ─────────────────────────────────────────────────────────────────────────────
// XP
// ─────────────────────────────────────────────────────────────────────────────

export interface XPResult {
  xpDelta: number;
  masteryBonus: boolean;
}

/**
 * Compute XP awarded for this attempt.
 * masteryStatus: the NEW mastery_status after compute_topic_score ran.
 * previousMasteryStatus: the status BEFORE this attempt.
 */
export function computeXP(
  isCorrect: boolean,
  masteryStatus: string,
  previousMasteryStatus: string
): XPResult {
  const base = isCorrect ? XP_CORRECT : XP_INCORRECT;
  const masteryBonus =
    masteryStatus === "mastered" && previousMasteryStatus !== "mastered";

  return {
    xpDelta: base + (masteryBonus ? XP_MASTERY_BONUS : 0),
    masteryBonus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Next-question recommendation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a hint about what the next question should target.
 * Used by the client to pre-warm the next generate-question call.
 */
export function nextQuestionHint(
  topicId: string,
  enrolledGrade: number,
  newOffset: number
): { topic_id: string; difficulty: number; effective_grade: number } {
  const effective = Math.max(1, Math.min(8, Math.round(enrolledGrade + newOffset)));
  return {
    topic_id: topicId,
    difficulty: effectiveDifficulty(enrolledGrade, newOffset),
    effective_grade: effective,
  };
}
