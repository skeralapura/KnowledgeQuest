/**
 * app/auth/callback/route.ts
 *
 * Handles the OAuth / magic-link / email-confirmation callback from Supabase.
 * Exchanges the `code` param for a session, then redirects to `next` (default: /quest-board).
 * If the student has no record yet (first login after sign-up), redirects to /onboarding.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/quest-board";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !sessionData.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const userId = sessionData.session.user.id;

  // Check if a students row already exists
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  // First-time sign-up: no student row yet — send to onboarding
  if (!student) {
    const onboardingResponse = NextResponse.redirect(`${origin}/onboarding`);
    // Copy auth cookies to new response
    response.cookies.getAll().forEach(({ name, value }) => {
      onboardingResponse.cookies.set(name, value);
    });
    return onboardingResponse;
  }

  return response;
}
