/**
 * middleware.ts
 *
 * Route protection for KnowledgeQuest.
 * - Public routes: /login, /auth/callback — accessible without a session
 * - All other routes: require an active Supabase session; redirect to /login if missing
 * - Also refreshes the session cookie on every request (required by @supabase/ssr)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through immediately (skip cookie refresh for speed)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Write refreshed cookies to both request and response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required on every request by @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run middleware on all routes except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
