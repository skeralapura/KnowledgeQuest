"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // After confirming email, redirect to onboarding to create student record
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
          },
        });
        if (signUpError) throw signUpError;

        // If email confirmation is disabled, the user is logged in immediately.
        // In that case, go straight to onboarding rather than showing the email notice.
        if (signUpData.session) {
          router.push("/onboarding");
          router.refresh();
        } else {
          setSignupDone(true);
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // Check whether this student has completed onboarding
        const { data: student } = await supabase
          .from("students")
          .select("id")
          .eq("id", signInData.user.id)
          .maybeSingle();

        if (!student) {
          router.push("/onboarding");
        } else {
          router.push("/quest-board");
        }
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Post sign-up confirmation notice ──────────────────────────────────────
  if (signupDone) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div
          className="card w-full max-w-md p-8 text-center"
          style={{ animation: "scale-in 400ms ease-out both" }}
        >
          {/* Atom icon */}
          <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(124,110,245,0.15)" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="3.5" fill="var(--color-accent-violet)" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-violet)" strokeWidth="1.5" fill="none" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none"
                transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none"
                transform="rotate(-60 16 16)" />
            </svg>
          </div>
          <h1 className="text-h2 mb-3" style={{ fontFamily: "var(--font-sora)" }}>
            Check your email
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }} className="text-body mb-6">
            We sent a confirmation link to{" "}
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{email}</span>.
            Click it to activate your account, then come back to sign in.
          </p>
          <button
            onClick={() => { setMode("signin"); setSignupDone(false); }}
            className="btn-primary w-full"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  // ── Main sign-in / sign-up form ───────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md"
        style={{ animation: "slide-up 300ms ease-out both" }}
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-card flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(124,110,245,0.2), rgba(45,212,191,0.1))",
              border: "1px solid rgba(124,110,245,0.3)",
              boxShadow: "var(--shadow-glow)",
            }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="3.5" fill="var(--color-accent-violet)" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-violet)" strokeWidth="1.5" fill="none" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none"
                transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none"
                transform="rotate(-60 16 16)" />
            </svg>
          </div>
          <h1 className="text-h1" style={{ fontFamily: "var(--font-sora)" }}>KnowledgeQuest</h1>
          <p className="text-sm-sq mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Adaptive K–8 learning
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* Tab toggle */}
          <div
            className="flex rounded-sm mb-6 p-1"
            style={{ background: "var(--color-bg-raised)" }}
            role="tablist"
            aria-label="Authentication mode"
          >
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(null); }}
                className="flex-1 py-2 text-sm-sq font-medium rounded-sm transition-all"
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontWeight: 500,
                  background: mode === m ? "var(--color-bg-surface)" : "transparent",
                  color: mode === m ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  border: mode === m ? "1px solid var(--color-border)" : "1px solid transparent",
                  boxShadow: mode === m ? "var(--shadow-surface)" : "none",
                  transition: "all var(--transition-default)",
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-sm-sq"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text-primary)",
                    padding: "10px 14px",
                    fontSize: "16px",
                    fontFamily: "var(--font-dm-sans)",
                    width: "100%",
                    minHeight: "44px",
                    outline: "none",
                    transition: "border-color var(--transition-default)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-accent-violet)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-border)")
                  }
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="password"
                  className="text-sm-sq"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min. 8 characters" : "Enter your password"}
                  style={{
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text-primary)",
                    padding: "10px 14px",
                    fontSize: "16px",
                    fontFamily: "var(--font-dm-sans)",
                    width: "100%",
                    minHeight: "44px",
                    outline: "none",
                    transition: "border-color var(--transition-default)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--color-accent-violet)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--color-border)")
                  }
                />
              </div>

              {/* Error */}
              {error && (
                <p
                  role="alert"
                  className="text-sm-sq px-3 py-2 rounded-sm"
                  style={{
                    color: "var(--color-accent-rose)",
                    background: "rgba(244,63,94,0.08)",
                    border: "1px solid rgba(244,63,94,0.2)",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary-glow w-full mt-2"
                style={{ opacity: loading ? 0.7 : 1 }}
                aria-busy={loading}
              >
                {loading
                  ? mode === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
              </button>
            </div>
          </form>

          {/* Footer note */}
          <p className="text-sm-sq text-center mt-6" style={{ color: "var(--color-text-muted)" }}>
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(null); }}
                  style={{ color: "var(--color-accent-violet)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", fontSize: "14px" }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("signin"); setError(null); }}
                  style={{ color: "var(--color-accent-violet)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", fontSize: "14px" }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Kid-friendly note */}
        <p className="text-xs-sq text-center mt-4" style={{ color: "var(--color-text-muted)" }}>
          Parents: you own this account. Students don&apos;t manage passwords.
        </p>
      </div>
    </main>
  );
}
