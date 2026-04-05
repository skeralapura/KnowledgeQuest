/**
 * /api/student-stats
 * Task 9 — Returns XP, streak, and explorer level for the NavBar.
 *
 * XP is computed from question_attempts (10 per correct, 2 per incorrect/skip).
 * Explorer level = floor(totalXP / 100) + 1, capped at 50.
 *
 * GET → 200 { total_xp, explorer_level, streak_count, streak_freeze_remaining }
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

// Service-role admin client — bypasses RLS, cache: no-store prevents stale data
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = makeAdminClient() as any;

  const [studentResult, attemptsResult] = await Promise.all([
    admin.from("students").select("streak_count, streak_freeze_remaining").eq("id", user.id).single(),
    admin.from("question_attempts").select("is_correct").eq("student_id", user.id),
  ]);

  const student = (studentResult.data as { streak_count: number; streak_freeze_remaining: number } | null) ?? {
    streak_count: 0,
    streak_freeze_remaining: 1,
  };

  const attempts = (attemptsResult.data as { is_correct: boolean }[] | null) ?? [];
  const totalXP = attempts.reduce(
    (sum, a) => sum + (a.is_correct ? 10 : 2),
    0
  );

  const explorerLevel = Math.min(50, Math.floor(totalXP / 100) + 1);

  return NextResponse.json({
    total_xp: totalXP,
    explorer_level: explorerLevel,
    streak_count: student.streak_count,
    streak_freeze_remaining: student.streak_freeze_remaining,
  });
}
