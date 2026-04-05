/**
 * /api/session-end
 * Task 9 — Called by the client when a session completes (≥5 questions answered).
 * Processes streak update and returns the result for the milestone modal.
 *
 * POST { session_id: string, questions_answered: number }
 * → 200 { new_streak, streak_extended, freeze_used, is_milestone, milestone_day }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { processStreakUpdate } from "@/lib/streak";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

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

export async function POST(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = makeSupabase(request, response);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : crypto.randomUUID();
  const questionsAnswered = typeof body.questions_answered === "number"
    ? Math.round(body.questions_answered)
    : 0;

  const result = await processStreakUpdate(user.id, sessionId, questionsAnswered);

  return NextResponse.json({
    new_streak: result.newStreak,
    streak_extended: result.streakExtended,
    freeze_used: result.freezeUsed,
    is_milestone: result.isMilestone,
    milestone_day: result.milestoneDay,
  });
}
