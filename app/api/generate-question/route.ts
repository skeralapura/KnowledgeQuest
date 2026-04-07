/**
 * /api/generate-question
 * Task 6 — Question generation endpoint (Sections 7 & 8)
 *
 * POST {
 *   topic_id: string
 *   format: string
 *   difficulty: number      (1–10)
 *   effective_grade: number (1–8)
 *   excluded_hashes?: string[]
 *   recent_wrong_concepts?: string
 * }
 *
 * → 200 { question, correct_answer, explanation, difficulty_delivered,
 *          format, question_hash, is_fallback? }
 * → 401 unauthenticated
 * → 429 rate limit exceeded
 * → 500 generation failed after all retries
 *
 * Flow:
 *  1. Auth + rate limit check
 *  2. Fetch student profile + topic from DB
 *  3. Sanitize inputs (Section 8.2)
 *  4. Up to MAX_RETRIES attempts:
 *     a. Call Claude (Section 7.2)
 *     b. Validate response (Section 8.3)
 *     c. Dedup check (Section 7.3)
 *  5. On exhaustion → serve fallback (Section 8.7)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { generateQuestion } from "@/lib/claude";
import { sanitizeInputs, validateResponse, getFallbackQuestion } from "@/lib/guardrails";
import { hashQuestion, isQuestionSeen } from "@/lib/dedup";
import type { Database } from "@/lib/database.types";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_RETRIES = 5;
const RATE_LIMIT_PER_HOUR = 60;

// In-memory rate limiter (per-student, resets on server restart).
// For production scale use Redis / Upstash — good enough for Phase 1.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// ── Rate limiter ───────────────────────────────────────────────────────────
function checkRateLimit(studentId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(studentId);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(studentId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_HOUR) return false;
  entry.count += 1;
  return true;
}

// ── Server Supabase client ────────────────────────────────────────────────
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

// ── Route handler ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const response = NextResponse.json({});          // placeholder, replaced below
  const supabase = makeSupabase(request, response);

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const studentId = user.id;

  // ── 2. Rate limit ─────────────────────────────────────────────────────────
  if (!checkRateLimit(studentId)) {
    return NextResponse.json(
      { error: "Take a short break! You've answered a lot of questions this hour." },
      { status: 429 }
    );
  }

  // ── 3. Parse + validate body ──────────────────────────────────────────────
  let body: {
    topic_id?: unknown;
    format?: unknown;
    difficulty?: unknown;
    effective_grade?: unknown;
    excluded_hashes?: unknown;
    excluded_concepts?: unknown;
    recent_wrong_concepts?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topicId = typeof body.topic_id === "string" ? body.topic_id : null;
  const format = typeof body.format === "string" ? body.format : "multiple_choice";
  const difficulty = Math.round(Math.max(1, Math.min(10, Number(body.difficulty) || 5)));
  const effectiveGrade = Math.round(Math.max(1, Math.min(8, Number(body.effective_grade) || 1)));
  const excludedHashes = Array.isArray(body.excluded_hashes)
    ? (body.excluded_hashes as unknown[]).filter((h): h is string => typeof h === "string")
    : [];
  const excludedConcepts = Array.isArray(body.excluded_concepts)
    ? (body.excluded_concepts as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const recentWrongConceptsRaw = typeof body.recent_wrong_concepts === "string"
    ? body.recent_wrong_concepts : "";

  if (!topicId) {
    return NextResponse.json({ error: "topic_id is required" }, { status: 400 });
  }

  // ── 4. Fetch student + topic ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [studentResult, topicResult] = await Promise.all([
    db.from("students").select("name, current_grade, interests").eq("id", studentId).single(),
    db.from("topics").select("id, name, standard, description, grade").eq("id", topicId).single(),
  ]);

  if (studentResult.error || !studentResult.data) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }
  if (topicResult.error || !topicResult.data) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const student = studentResult.data as {
    name: string;
    current_grade: number;
    interests: string[];
  };
  const topic = topicResult.data as {
    id: string;
    name: string;
    standard: string;
    description: string;
    grade: number;
  };

  // ── 5. Sanitize inputs (Section 8.2) ─────────────────────────────────────
  let sanitized;
  try {
    sanitized = sanitizeInputs({
      name: student.name,
      interests: student.interests ?? [],
      recent_wrong_concepts: recentWrongConceptsRaw,
    });
  } catch (err) {
    console.error("[generate-question] sanitize error", err);
    return NextResponse.json({ error: "Invalid student data" }, { status: 400 });
  }

  // ── 6. Generation loop (up to MAX_RETRIES) ────────────────────────────────
  const currentExcluded = [...excludedHashes];
  let lastFailureDetail = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let raw: unknown;

    try {
      raw = await generateQuestion({
        studentName: sanitized.name,
        enrolledGrade: student.current_grade,
        effectiveGrade,
        difficulty,
        topicId: topic.id,
        topicName: topic.name,
        topicStandard: topic.standard,
        topicDescription: topic.description,
        format,
        interests: sanitized.interests,
        recentWrongConcepts: sanitized.recent_wrong_concepts,
        excludedHashes: currentExcluded,
        excludedConcepts,
      });
    } catch (err) {
      lastFailureDetail = err instanceof Error ? err.message : "API call failed";
      console.error(`[generate-question] attempt ${attempt + 1} API error:`, lastFailureDetail);
      continue;
    }

    // ── Validate response (Section 8.3) ──────────────────────────────────
    const validation = validateResponse(raw, format);

    if (!validation.ok) {
      lastFailureDetail = validation.detail;

      if (validation.reason === "fallback") {
        // Claude returned unable_to_generate — serve fallback immediately
        break;
      }
      // reason === "retry" — try again
      console.warn(`[generate-question] attempt ${attempt + 1} validation fail: ${validation.detail}`);
      continue;
    }

    const questionData = validation.data;

    // ── Dedup check (Section 7.3) ────────────────────────────────────────
    const hash = hashQuestion(questionData.question);

    // Hard block: question already shown this session
    if (currentExcluded.includes(hash)) {
      lastFailureDetail = `session duplicate hash ${hash}`;
      console.warn(`[generate-question] attempt ${attempt + 1} session dedup hit: ${hash}`);
      continue;
    }

    // Cross-session block: student answered this correctly before
    const alreadySeen = await isQuestionSeen(studentId, hash);

    if (alreadySeen) {
      lastFailureDetail = `duplicate hash ${hash}`;
      console.warn(`[generate-question] attempt ${attempt + 1} dedup hit: ${hash}`);
      currentExcluded.push(hash);
      continue;
    }

    // ── Success ──────────────────────────────────────────────────────────
    return NextResponse.json({
      question: questionData.question,
      choices: Array.isArray(questionData.choices) ? questionData.choices : undefined,
      correct_answer: questionData.correct_answer,
      explanation: questionData.explanation,
      difficulty_delivered: questionData.difficulty_delivered,
      format: questionData.format,
      question_hash: hash,   // use our own computed hash, not Claude's
      concept_tag: typeof questionData.concept_tag === "string" ? questionData.concept_tag : undefined,
    });
  }

  // ── 7. All retries exhausted — serve fallback (Section 8.7) ──────────────
  console.error(
    `[generate-question] all ${MAX_RETRIES} attempts failed for student=${studentId} topic=${topicId}. Last: ${lastFailureDetail}`
  );

  const fallback = getFallbackQuestion(student.current_grade);
  const fallbackHash = hashQuestion(fallback.question);

  return NextResponse.json({
    question: fallback.question,
    correct_answer: fallback.correct_answer,
    explanation: "Great effort! Keep practising — you'll get it!",
    difficulty_delivered: 1,
    format: fallback.format,
    question_hash: fallbackHash,
    is_fallback: true,
  });
}
