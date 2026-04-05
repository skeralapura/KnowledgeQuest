/**
 * lib/dedup.ts
 * Task 6 — Question deduplication (Section 7.3)
 *
 * Generates a 16-char SHA-256 hash from the question text and checks
 * question_seen to prevent repeating questions the student already answered
 * correctly.
 *
 * Server-side only.
 */

import { createHash } from "crypto";
import { createServerSupabaseClient } from "./supabase-server";

// ─────────────────────────────────────────────────────────────────────────────
// Hash generation
// SHA-256(questionText.toLowerCase().trim()).slice(0, 16)
// ─────────────────────────────────────────────────────────────────────────────

export function hashQuestion(questionText: string): string {
  return createHash("sha256")
    .update(questionText.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedup check
// Returns true if this question should be skipped (seen + last_was_correct).
// ─────────────────────────────────────────────────────────────────────────────

export async function isQuestionSeen(
  studentId: string,
  hash: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("question_seen")
    .select("last_was_correct")
    .eq("student_id", studentId)
    .eq("question_hash", hash)
    .maybeSingle();

  // Only skip if the student previously answered this question correctly.
  // If they got it wrong before, let them see it again.
  const row = data as { last_was_correct: boolean } | null;
  return row?.last_was_correct === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Record a seen question (called after answer submission — Task 7)
// Exposed here so Task 7's submit-answer route can import it without
// importing the full Supabase server client directly.
// ─────────────────────────────────────────────────────────────────────────────

export async function recordQuestionSeen(
  studentId: string,
  hash: string,
  wasCorrect: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("upsert_question_seen", {
    p_student_id: studentId,
    p_hash: hash,
    p_was_correct: wasCorrect,
  });
}
