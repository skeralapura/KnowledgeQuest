/**
 * /api/onboarding/complete
 * Creates the students row after the onboarding flow.
 * Requires an active Supabase session (protected by middleware).
 *
 * POST { name: string, current_grade: number, interests: string[] }
 * → 200 { ok: true }
 * → 400 on validation failure
 * → 401 if no session
 * → 500 on DB error
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { INTEREST_TAGS } from "@/lib/constants/interest-tags";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const VALID_TAGS = new Set<string>(INTEREST_TAGS);

function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30).trim();
}

export async function POST(request: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { name?: unknown; current_grade?: unknown; interests?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Validate name ─────────────────────────────────────────────────────────
  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const name = sanitizeName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Name is empty after sanitization" }, { status: 400 });
  }

  // ── Validate grade ────────────────────────────────────────────────────────
  const grade = Number(body.current_grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 8) {
    return NextResponse.json({ error: "current_grade must be an integer 1–8" }, { status: 400 });
  }

  // ── Validate interests ────────────────────────────────────────────────────
  if (!Array.isArray(body.interests)) {
    return NextResponse.json({ error: "interests must be an array" }, { status: 400 });
  }
  const interests: string[] = (body.interests as unknown[])
    .filter((t): t is string => typeof t === "string" && VALID_TAGS.has(t))
    .slice(0, 10);

  if (interests.length < 3) {
    return NextResponse.json({ error: "Please pick at least 3 interests" }, { status: 400 });
  }

  // ── Supabase auth ─────────────────────────────────────────────────────────
  const response = NextResponse.json({ ok: true });

  // Use service role key so we can write the students row as the user's own ID.
  // RLS on students requires id = auth.uid(), which holds here.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name: n, value, options }) =>
            response.cookies.set(n, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Upsert students row ───────────────────────────────────────────────────
  // Use upsert so re-submitting onboarding (e.g. browser back) is idempotent
  type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];
  const studentRow: StudentInsert = {
    id: user.id,
    name,
    current_grade: grade,
    interests,
    streak_count: 0,
    streak_freeze_remaining: 1,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase.from("students") as any)
    .upsert(studentRow, { onConflict: "id" });

  if (dbError) {
    console.error("[onboarding/complete] DB error", dbError.message);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return response;
}
