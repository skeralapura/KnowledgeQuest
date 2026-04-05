/**
 * /api/report/weekly
 * Task 11 — Trigger for the weekly digest edge function.
 *
 * Accepts two auth modes:
 *  1. Vercel Cron (GET) — verified via Authorization: Bearer <CRON_SECRET>
 *  2. Manual POST { secret } — verified against WEEKLY_DIGEST_SECRET
 *
 * → 200 { invoked: true }
 * → 401 — wrong or missing secret
 * → 503 — env vars not configured
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function invokeEdgeFunction() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return false;

  fetch(`${supabaseUrl}/functions/v1/weekly-digest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch((err) => {
    console.error("[report/weekly] edge function invoke error:", err.message);
  });
  return true;
}

// Vercel Cron sends GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = invokeEdgeFunction();
  if (!ok) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  return NextResponse.json({ invoked: true });
}

// Manual POST trigger
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.WEEKLY_DIGEST_SECRET;
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = invokeEdgeFunction();
  if (!ok) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  return NextResponse.json({ invoked: true });
}
