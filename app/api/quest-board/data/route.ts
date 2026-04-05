/**
 * /api/quest-board/data
 * Task 10 — Fetches all math topics + the student's topic_scores in one call.
 *
 * GET → 200 {
 *   topics: Topic[],
 *   scores: Record<topicId, TopicScore>,
 *   student: { current_grade: number, name: string }
 * }
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

function makeSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

// Service-role admin client — bypasses RLS for data queries
// Custom fetch disables Next.js 14's default server-side fetch cache
function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = makeSupabase(request, response);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Use admin client for all data queries so RLS doesn't interfere
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = makeAdminClient() as any;

  const [topicsResult, scoresResult, studentResult] = await Promise.all([
    admin.from("topics").select("id, name, description, grade, standard, subject, diff_min, diff_max").eq("subject", "math").order("grade").order("name"),
    admin.from("topic_scores").select("topic_id, mastery_status, confidence_score, attempts_count, correct_count").eq("student_id", user.id),
    admin.from("students").select("current_grade, name").eq("id", user.id).single(),
  ]);

  if (topicsResult.error) {
    console.error("[quest-board] topics fetch error:", topicsResult.error.message);
    return NextResponse.json({ error: "Failed to load topics" }, { status: 500 });
  }

  // Build scores map keyed by topic_id
  type ScoreRow = { topic_id: string; mastery_status: string; confidence_score: number; attempts_count: number; correct_count: number };
const scoresMap: Record<string, ScoreRow> = {};
  if (scoresResult.data) {
    for (const row of scoresResult.data as ScoreRow[]) {
      scoresMap[row.topic_id] = row;
    }
  }

  const student = (studentResult.data as { current_grade: number; name: string } | null) ?? {
    current_grade: 1,
    name: "Explorer",
  };

  return NextResponse.json({
    topics: topicsResult.data ?? [],
    scores: scoresMap,
    student,
  });
}
