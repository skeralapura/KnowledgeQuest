/**
 * lib/supabase-server.ts
 * Server-side Supabase client — import only in Server Components and Route Handlers.
 * Uses next/headers, so it cannot be imported in Client Components.
 */

import { createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}
