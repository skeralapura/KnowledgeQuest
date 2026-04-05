/**
 * supabase/functions/weekly-digest/index.ts
 * Task 11 — Weekly parent digest edge function
 *
 * Scheduled: Monday 09:00 ET (14:00 UTC) via Supabase cron
 * Configure in Supabase dashboard → Edge Functions → Schedules:
 *   cron: "0 14 * * 1"   (every Monday 14:00 UTC)
 *
 * For each student who has been active in the last 7 days:
 *   1. Calls compute_weekly_report(student_id, week_start)
 *   2. Fetches the freshly upserted weekly_reports row
 *   3. Sends a plain-text summary email via SendGrid
 *
 * No PII is written to logs. student_id (UUID) is the only identifier logged.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SENDGRID_API_KEY
 *   SENDGRID_FROM_EMAIL   (verified sender address)
 *   APP_BASE_URL          (e.g. https://sciencequest.vercel.app)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@sciencequest.app";
const APP_URL = Deno.env.get("APP_BASE_URL") ?? "https://sciencequest.vercel.app";

/** Returns the Monday of the current week (UTC) as "YYYY-MM-DD" */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** Format week range for the email subject */
function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(d)} – ${fmt(end)}`;
}

interface StudentRow {
  id: string;
  name: string;
  // email comes from auth.users — fetched separately
}

interface WeeklyReportRow {
  total_questions: number;
  overall_accuracy: number | null;
  topics_mastered: { topic_name: string }[];
  struggle_areas: { topic_name: string; accuracy: number }[];
  streak_at_week_end: number;
}

Deno.serve(async (_req) => {
  const weekStart = currentWeekStart();
  console.log(`[weekly-digest] running for week_start=${weekStart}`);

  // 1. Find students active in the last 7 days
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);

  const { data: activeStudents, error: studentsError } = await supabase
    .from("students")
    .select("id, name")
    .gte("last_active_date", cutoff.toISOString().slice(0, 10));

  if (studentsError || !activeStudents) {
    console.error("[weekly-digest] failed to fetch active students:", studentsError?.message);
    return new Response("error fetching students", { status: 500 });
  }

  console.log(`[weekly-digest] ${activeStudents.length} active students`);

  let sent = 0;
  let failed = 0;

  for (const student of activeStudents as StudentRow[]) {
    try {
      // 2. Compute / refresh the weekly report
      const { error: rpcError } = await supabase.rpc("compute_weekly_report", {
        p_student_id: student.id,
        p_week_start: weekStart,
      });

      if (rpcError) {
        console.error(`[weekly-digest] compute_weekly_report error for student=${student.id}:`, rpcError.message);
        failed++;
        continue;
      }

      // 3. Fetch the freshly computed report
      const { data: reportData, error: reportError } = await supabase
        .from("weekly_reports")
        .select("total_questions, overall_accuracy, topics_mastered, struggle_areas, streak_at_week_end")
        .eq("student_id", student.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (reportError || !reportData) {
        console.error(`[weekly-digest] fetch report error for student=${student.id}`);
        failed++;
        continue;
      }

      const report = reportData as WeeklyReportRow;

      // 4. Get email from auth.users (service role only)
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(student.id);
      if (userError || !userData?.user?.email) {
        console.error(`[weekly-digest] no email for student=${student.id}`);
        failed++;
        continue;
      }

      const email = userData.user.email;

      // 5. Build email body
      const accuracyPct = report.overall_accuracy != null
        ? `${Math.round(report.overall_accuracy * 100)}%`
        : "N/A";

      const masteredList = report.topics_mastered.length > 0
        ? report.topics_mastered.map((t) => `  • ${t.topic_name}`).join("\n")
        : "  (none this week)";

      const struggleList = report.struggle_areas.length > 0
        ? report.struggle_areas.map((a) => `  • ${a.topic_name} (${Math.round(a.accuracy * 100)}%)`).join("\n")
        : "  (great work — no struggle areas!)";

      const subject = `ScienceQuest: ${student.name}'s week of ${weekLabel(weekStart)}`;

      const text = `Hi there!

Here's ${student.name}'s learning summary for ${weekLabel(weekStart)}.

📊 THIS WEEK
  Questions answered : ${report.total_questions}
  Overall accuracy   : ${accuracyPct}
  Streak at week end : ${report.streak_at_week_end} days

🏆 TOPICS MASTERED
${masteredList}

💪 KEEP PRACTISING
${struggleList}

View the full report: ${APP_URL}/report

Keep up the great work!
— The ScienceQuest Team
`;

      // 6. Send via SendGrid
      if (!SENDGRID_API_KEY) {
        console.warn(`[weekly-digest] SENDGRID_API_KEY not set — skipping send for student=${student.id}`);
        sent++;
        continue;
      }

      const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: FROM_EMAIL, name: "ScienceQuest" },
          subject,
          content: [{ type: "text/plain", value: text }],
        }),
      });

      if (!sgRes.ok) {
        // Log status code only — no email address in logs
        console.error(`[weekly-digest] SendGrid ${sgRes.status} for student=${student.id}`);
        failed++;
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[weekly-digest] unexpected error for student=${student.id}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`[weekly-digest] done. sent=${sent} failed=${failed}`);
  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
