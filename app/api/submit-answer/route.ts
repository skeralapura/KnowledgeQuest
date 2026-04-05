/**
 * /api/submit-answer
 * Task 7 — Answer submission, scoring, and logging (Section 7 + 8.5)
 *
 * POST {
 *   topic_id: string
 *   question_hash: string
 *   question_format: string          "multiple_choice" | "fill_blank_numeric" | "word_problem" | ...
 *   difficulty_delivered: number     1–10
 *   student_answer: string           the student's selected/typed answer
 *   correct_answer: string           the correct answer (from generate-question response)
 *   question_text: string            needed for word_problem Claude validation call
 *   current_difficulty_offset: number
 *   time_to_answer_ms?: number
 *   reread_count?: number
 *   was_skipped?: boolean
 *   scenario_theme?: string
 * }
 *
 * → 200 {
 *     is_correct: boolean,
 *     explanation: string,
 *     xp_delta: number,
 *     mastery_bonus: boolean,
 *     new_mastery_status: string,
 *     new_difficulty_offset: number,
 *     next_question_hint: { topic_id, difficulty, effective_grade }
 *   }
 *
 * Answer validation by format:
 *  - multiple_choice / fill_blank_numeric / ordering / true_false_why:
 *      deterministic string comparison (normalised)
 *  - word_problem / multi_step:
 *      second Claude call via callClaudeValidation() with full guardrails (Section 8.5)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { callClaudeValidation } from "@/lib/claude";
import { validateValidationCallResponse } from "@/lib/guardrails";
import { recordQuestionSeen } from "@/lib/dedup";
import { nextDifficultyOffset, computeXP, nextQuestionHint } from "@/lib/mastery";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// Formats that get deterministic validation
const DETERMINISTIC_FORMATS = new Set([
  "multiple_choice",
  "fill_blank_numeric",
  "ordering",
  "true_false_why",
]);

// Formats that need a Claude validation call
const CLAUDE_VALIDATED_FORMATS = new Set([
  "word_problem",
  "multi_step",
]);

// ── Deterministic answer check ─────────────────────────────────────────────
function checkDeterministic(studentAnswer: string, correctAnswer: string): boolean {
  const normalise = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:]/g, "");
  return normalise(studentAnswer) === normalise(correctAnswer);
}

// ── Supabase helper ────────────────────────────────────────────────────────
function makeSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = makeSupabase(request, response);

  // ── Auth ────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const studentId = user.id;

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topicId              = typeof body.topic_id === "string" ? body.topic_id : null;
  const questionHash         = typeof body.question_hash === "string" ? body.question_hash : null;
  const questionFormat       = typeof body.question_format === "string" ? body.question_format : "multiple_choice";
  const difficultyDelivered  = Math.round(Math.max(1, Math.min(10, Number(body.difficulty_delivered) || 5)));
  const studentAnswer        = typeof body.student_answer === "string" ? body.student_answer.slice(0, 500) : "";
  const correctAnswer        = typeof body.correct_answer === "string" ? body.correct_answer.slice(0, 200) : "";
  const questionText         = typeof body.question_text === "string" ? body.question_text.slice(0, 800) : "";
  const currentOffset        = typeof body.current_difficulty_offset === "number" ? body.current_difficulty_offset : 0;
  const timeToAnswerMs       = typeof body.time_to_answer_ms === "number" ? Math.round(body.time_to_answer_ms) : null;
  const rereadCount          = typeof body.reread_count === "number" ? Math.round(body.reread_count) : 0;
  const wasSkipped           = body.was_skipped === true;
  const scenarioTheme        = typeof body.scenario_theme === "string" ? body.scenario_theme.slice(0, 50) : null;

  if (!topicId || !questionHash) {
    return NextResponse.json({ error: "topic_id and question_hash are required" }, { status: 400 });
  }

  // ── Fetch student grade (needed for XP + difficulty) ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: studentData } = await db
    .from("students")
    .select("current_grade")
    .eq("id", studentId)
    .single();

  const enrolledGrade: number = (studentData as { current_grade: number } | null)?.current_grade ?? 1;

  // ── Fetch previous mastery status (to detect mastery flip for bonus XP) ──
  const { data: prevScore } = await db
    .from("topic_scores")
    .select("mastery_status")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const previousMasteryStatus: string = (prevScore as { mastery_status: string } | null)?.mastery_status ?? "learning";

  // ── Validate answer ──────────────────────────────────────────────────────
  let isCorrect: boolean;
  let explanation: string;

  if (wasSkipped) {
    isCorrect = false;
    explanation = "You skipped this one — that's okay! Try it next time.";
  } else if (DETERMINISTIC_FORMATS.has(questionFormat)) {
    isCorrect = checkDeterministic(studentAnswer, correctAnswer);
    explanation = isCorrect
      ? "Great job! That's exactly right."
      : `Not quite — the correct answer is ${correctAnswer}.`;
  } else if (CLAUDE_VALIDATED_FORMATS.has(questionFormat)) {
    // Section 8.5 — word_problem validation call with full guardrails
    try {
      const raw = await callClaudeValidation(questionText, studentAnswer, correctAnswer);
      const validation = validateValidationCallResponse(raw);

      if (validation.ok) {
        isCorrect = validation.data.correct;
        explanation = validation.data.explanation;
      } else {
        // Guardrail failure on validation call — fall back to deterministic
        console.warn("[submit-answer] validation call guardrail fail:", validation.detail);
        isCorrect = checkDeterministic(studentAnswer, correctAnswer);
        explanation = isCorrect ? "Correct!" : `The answer is ${correctAnswer}.`;
      }
    } catch (err) {
      // API error — fall back to deterministic
      console.error("[submit-answer] Claude validation call failed:", err);
      isCorrect = checkDeterministic(studentAnswer, correctAnswer);
      explanation = isCorrect ? "Correct!" : `The answer is ${correctAnswer}.`;
    }
  } else {
    // Unknown format — deterministic fallback
    isCorrect = checkDeterministic(studentAnswer, correctAnswer);
    explanation = isCorrect ? "Correct!" : `The answer is ${correctAnswer}.`;
  }

  // ── INSERT question_attempts ─────────────────────────────────────────────
  const { error: insertError } = await db.from("question_attempts").insert({
    student_id:          studentId,
    topic_id:            topicId,
    question_hash:       questionHash,
    question_format:     questionFormat,
    difficulty_delivered: difficultyDelivered,
    is_correct:          isCorrect,
    time_to_answer_ms:   timeToAnswerMs,
    reread_count:        rereadCount,
    was_skipped:         wasSkipped,
    scenario_theme:      scenarioTheme,
  });

  if (insertError) {
    console.error("[submit-answer] INSERT question_attempts error:", insertError.message);
    // Non-fatal — continue so student sees feedback
  }

  // ── Call compute_topic_score (Postgres function — single source of truth) ─
  const { error: scoreError } = await db.rpc("compute_topic_score", {
    p_student_id: studentId,
    p_topic_id:   topicId,
  });

  if (scoreError) {
    console.error("[submit-answer] compute_topic_score error:", scoreError.message);
  }

  // ── Call upsert_question_seen ────────────────────────────────────────────
  await recordQuestionSeen(studentId, questionHash, isCorrect);

  // ── Fetch new mastery status ─────────────────────────────────────────────
  const { data: newScore } = await db
    .from("topic_scores")
    .select("mastery_status")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const newMasteryStatus: string = (newScore as { mastery_status: string } | null)?.mastery_status ?? "learning";

  // ── Compute XP + next difficulty ─────────────────────────────────────────
  const { xpDelta, masteryBonus } = computeXP(isCorrect, newMasteryStatus, previousMasteryStatus);
  const newOffset = nextDifficultyOffset(currentOffset, isCorrect);
  const nextHint = nextQuestionHint(topicId, enrolledGrade, newOffset);

  // ── Return ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    is_correct:             isCorrect,
    explanation,
    xp_delta:               xpDelta,
    mastery_bonus:          masteryBonus,
    new_mastery_status:     newMasteryStatus,
    new_difficulty_offset:  newOffset,
    next_question_hint:     nextHint,
  });
}
