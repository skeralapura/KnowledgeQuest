/**
 * /api/moderate-name
 * Decision 3: run student-submitted names through OpenAI Moderation API.
 * Server-side only — OPENAI_API_KEY never exposed to browser.
 *
 * POST { name: string }
 * → 200 { flagged: boolean }
 * → 400 if input invalid
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Sanitize name to alphanumeric + spaces only, max 30 chars (Section 8.2)
function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30).trim();
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const name = sanitizeName(body.name);
  if (!name) {
    return NextResponse.json({ flagged: true });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Safe-fail: if key not configured, reject
    console.error("[moderate-name] OPENAI_API_KEY not set");
    return NextResponse.json({ flagged: true });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: name }),
    });

    if (!res.ok) {
      console.error("[moderate-name] OpenAI API error", res.status);
      // Safe-fail: reject on API error
      return NextResponse.json({ flagged: true });
    }

    const data = await res.json();
    const flagged: boolean = data?.results?.[0]?.flagged ?? false;

    return NextResponse.json({ flagged });
  } catch (err) {
    console.error("[moderate-name] fetch error", err);
    return NextResponse.json({ flagged: true });
  }
}
