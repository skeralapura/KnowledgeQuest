/**
 * /api/report/data
 * Task 11 — Fetch the most recent weekly report for the authenticated student.
 *
 * If no report exists yet for the current week, calls compute_weekly_report
 * Postgres function on-demand so the student always sees fresh data.
 *
 * GET → 200 { report: WeeklyReport, student: { name, current_grade } }
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

/** Returns the Monday of the current week (UTC) as "YYYY-MM-DD" */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
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
  const weekStart = currentWeekStart();

  // Try to fetch the most recent report (this week or previous)
  const { data: existingReport } = await admin
    .from("weekly_reports")
    .select("*")
    .eq("student_id", user.id)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If there's no report for this week, compute it on-demand
  let report = existingReport as WeeklyReportRow | null;
  if (!report || report.week_start !== weekStart) {
    await admin.rpc("compute_weekly_report", {
      p_student_id: user.id,
      p_week_start: weekStart,
    });

    const { data: freshReport } = await admin
      .from("weekly_reports")
      .select("*")
      .eq("student_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    report = (freshReport as WeeklyReportRow | null) ?? report;
  }

  // Fetch student profile
  const { data: studentData } = await admin
    .from("students")
    .select("name, current_grade")
    .eq("id", user.id)
    .single();

  const student = (studentData as { name: string; current_grade: number } | null) ?? {
    name: "Explorer",
    current_grade: 1,
  };

  return NextResponse.json({ report, student });
}

// ── Local type (mirrors weekly_reports table) ──────────────────────────────
interface WeeklyReportRow {
  id: string;
  student_id: string;
  week_start: string;
  topics_attempted: unknown[];
  topics_mastered: unknown[];
  struggle_areas: unknown[];
  overall_accuracy: number | null;
  total_questions: number;
  streak_at_week_end: number;
  generated_at: string;
}
