"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { INTEREST_TAG_GROUPS, type InterestTag } from "@/lib/constants/interest-tags";

// ── Types ──────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  grade: number | null;
  interests: InterestTag[];
}

type Step = 1 | 2 | 3;

// ── Animation variants ─────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
const GRADE_LABELS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th",
  5: "5th", 6: "6th", 7: "7th", 8: "8th",
};
const MAX_INTERESTS = 10;

// ── Step indicators ────────────────────────────────────────────────────────
function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" role="progressbar"
      aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}
      aria-label={`Step ${step} of 3`}>
      {([1, 2, 3] as Step[]).map((s) => (
        <div
          key={s}
          style={{
            width: s === step ? 24 : 8,
            height: 8,
            borderRadius: "9999px",
            background: s === step
              ? "var(--color-accent-violet)"
              : s < step
              ? "var(--color-accent-cyan)"
              : "var(--color-bg-raised)",
            border: `1px solid ${s <= step ? "transparent" : "var(--color-border)"}`,
            transition: "all 300ms ease-out",
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>({ name: "", grade: null, interests: [] });
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goTo(next: Step) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function toggleInterest(tag: InterestTag) {
    setForm((prev) => {
      const has = prev.interests.includes(tag);
      if (!has && prev.interests.length >= MAX_INTERESTS) return prev;
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((t) => t !== tag)
          : [...prev.interests, tag],
      };
    });
  }

  async function validateName(): Promise<boolean> {
    setNameError(null);
    const trimmed = form.name.trim();
    if (!trimmed) { setNameError("Please enter a name."); return false; }
    if (trimmed.length > 30) { setNameError("Name must be 30 characters or fewer."); return false; }
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
      setNameError("Name can only contain letters, numbers, and spaces.");
      return false;
    }

    // OpenAI Moderation API check (Decision 3)
    try {
      const res = await fetch("/api/moderate-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (data.flagged) {
        setNameError("That name isn't allowed. Please use your real first name.");
        return false;
      }
    } catch {
      // Moderation API failure → safe-fail: reject
      setNameError("We couldn't verify your name. Please try again.");
      return false;
    }

    return true;
  }

  async function handleStepTwoNext() {
    if (!form.grade) return;
    const ok = await validateName();
    if (ok) goTo(3);
  }

  async function handleSubmit() {
    setSubmitError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          current_grade: form.grade,
          interests: form.interests,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong.");
      }
      router.push("/quest-board");
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1 — Welcome ────────────────────────────────────────────────────
  const step1 = (
    <div className="flex flex-col items-center text-center">
      {/* Animated atom logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-8 relative"
      >
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(124,110,245,0.2), rgba(45,212,191,0.1))",
            border: "1px solid rgba(124,110,245,0.35)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            <circle cx="26" cy="26" r="5" fill="var(--color-accent-violet)" />
            <ellipse cx="26" cy="26" rx="22" ry="9" stroke="var(--color-accent-violet)" strokeWidth="1.8" fill="none" />
            <ellipse cx="26" cy="26" rx="22" ry="9" stroke="var(--color-accent-cyan)" strokeWidth="1.8" fill="none" transform="rotate(60 26 26)" />
            <ellipse cx="26" cy="26" rx="22" ry="9" stroke="var(--color-accent-cyan)" strokeWidth="1.8" fill="none" transform="rotate(-60 26 26)" />
          </svg>
        </div>
      </motion.div>

      <motion.h1
        className="text-h1 mb-3"
        style={{ fontFamily: "var(--font-sora)" }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Welcome to KnowledgeQuest!
      </motion.h1>
      <motion.p
        className="text-body-lg mb-2"
        style={{ color: "var(--color-text-secondary)", maxWidth: 360 }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18 }}
      >
        Questions made just for you — powered by AI, themed around things you love.
      </motion.p>
      <motion.p
        className="text-sm-sq mb-10"
        style={{ color: "var(--color-text-muted)" }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.24 }}
      >
        Takes about 60 seconds to set up.
      </motion.p>

      <motion.button
        className="btn-primary-glow"
        style={{ minWidth: 200 }}
        onClick={() => goTo(2)}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.32 }}
        whileTap={{ scale: 0.97 }}
      >
        Let&apos;s go →
      </motion.button>
    </div>
  );

  // ── Step 2 — Name + Grade + Interests ──────────────────────────────────
  const step2 = (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h2 mb-1" style={{ fontFamily: "var(--font-sora)" }}>
          Tell us about you
        </h2>
        <p className="text-sm-sq" style={{ color: "var(--color-text-secondary)" }}>
          Pick your grade and at least 3 things you love.
        </p>
      </div>

      {/* Name field */}
      <div className="flex flex-col gap-1">
        <label htmlFor="student-name" className="text-sm-sq" style={{ color: "var(--color-text-secondary)" }}>
          First name
        </label>
        <input
          id="student-name"
          type="text"
          autoComplete="given-name"
          maxLength={30}
          value={form.name}
          onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setNameError(null); }}
          placeholder="Your first name"
          style={{
            background: "var(--color-bg-raised)",
            border: `1px solid ${nameError ? "var(--color-accent-rose)" : "var(--color-border)"}`,
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
          onFocus={(e) => (e.target.style.borderColor = "var(--color-accent-violet)")}
          onBlur={(e) => (e.target.style.borderColor = nameError ? "var(--color-accent-rose)" : "var(--color-border)")}
        />
        {nameError && (
          <p className="text-sm-sq" role="alert" style={{ color: "var(--color-accent-rose)" }}>
            {nameError}
          </p>
        )}
      </div>

      {/* Grade selector */}
      <div className="flex flex-col gap-2">
        <p className="text-sm-sq" style={{ color: "var(--color-text-secondary)" }}>
          What grade are you in?
        </p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Select your grade">
          {GRADES.map((g) => (
            <button
              key={g}
              role="radio"
              aria-checked={form.grade === g}
              onClick={() => setForm((p) => ({ ...p, grade: g }))}
              style={{
                background: form.grade === g ? "var(--color-accent-violet)" : "var(--color-bg-raised)",
                border: `1px solid ${form.grade === g ? "var(--color-accent-violet)" : "var(--color-border)"}`,
                borderRadius: "var(--radius-sm)",
                color: form.grade === g ? "white" : "var(--color-text-secondary)",
                fontFamily: "var(--font-sora)",
                fontWeight: 600,
                fontSize: "14px",
                minHeight: "44px",
                cursor: "pointer",
                transition: "all var(--transition-default)",
                boxShadow: form.grade === g ? "var(--shadow-glow)" : "none",
              }}
            >
              {GRADE_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Interest tag picker */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm-sq" style={{ color: "var(--color-text-secondary)" }}>
            Pick your interests (choose at least 3)
          </p>
          <span
            className="text-xs-sq px-2 py-1 rounded-pill"
            style={{
              background: form.interests.length >= MAX_INTERESTS
                ? "rgba(244,63,94,0.1)"
                : "var(--color-bg-raised)",
              color: form.interests.length >= MAX_INTERESTS
                ? "var(--color-accent-rose)"
                : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {form.interests.length}/{MAX_INTERESTS}
          </span>
        </div>

        {INTEREST_TAG_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs-sq mb-2" style={{ color: "var(--color-text-muted)" }}>
              {group.emoji} {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const selected = form.interests.includes(tag);
                const disabled = !selected && form.interests.length >= MAX_INTERESTS;
                return (
                  <button
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    disabled={disabled}
                    aria-pressed={selected}
                    style={{
                      background: selected ? "rgba(124,110,245,0.15)" : "var(--color-bg-raised)",
                      border: `1px solid ${selected ? "var(--color-accent-violet)" : "var(--color-border)"}`,
                      borderRadius: "var(--radius-pill)",
                      color: selected ? "var(--color-accent-violet)" : disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "13px",
                      fontWeight: 500,
                      padding: "6px 14px",
                      minHeight: "32px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                      transition: "all var(--transition-default)",
                    }}
                  >
                    {selected && <span aria-hidden="true">✓ </span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={handleStepTwoNext}
        disabled={!form.name.trim() || !form.grade || form.interests.length < 3}
        className="btn-primary w-full mt-2"
        style={{
          opacity: (!form.name.trim() || !form.grade || form.interests.length < 3) ? 0.45 : 1,
          cursor: (!form.name.trim() || !form.grade || form.interests.length < 3) ? "not-allowed" : "pointer",
        }}
      >
        Next →
      </button>
    </div>
  );

  // ── Step 3 — Confirm ────────────────────────────────────────────────────
  const step3 = (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h2 mb-1" style={{ fontFamily: "var(--font-sora)" }}>
          Looking good, {form.name}!
        </h2>
        <p className="text-sm-sq" style={{ color: "var(--color-text-secondary)" }}>
          Here&apos;s what we&apos;ll use to personalise your questions.
        </p>
      </div>

      {/* Summary card */}
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm-sq" style={{ color: "var(--color-text-muted)" }}>Name</span>
          <span className="text-body" style={{ fontWeight: 500 }}>{form.name}</span>
        </div>
        <div
          style={{ height: 1, background: "var(--color-border)" }}
          role="separator"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm-sq" style={{ color: "var(--color-text-muted)" }}>Grade</span>
          <span
            className="badge"
            style={{
              background: "rgba(124,110,245,0.15)",
              color: "var(--color-accent-violet)",
              border: "1px solid rgba(124,110,245,0.3)",
            }}
          >
            {GRADE_LABELS[form.grade!]} Grade
          </span>
        </div>
        <div style={{ height: 1, background: "var(--color-border)" }} role="separator" />
        <div className="flex flex-col gap-2">
          <span className="text-sm-sq" style={{ color: "var(--color-text-muted)" }}>
            Interests ({form.interests.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {form.interests.map((tag) => (
              <span
                key={tag}
                className="badge"
                style={{
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {submitError && (
        <p
          role="alert"
          className="text-sm-sq px-3 py-2 rounded-sm"
          style={{
            color: "var(--color-accent-rose)",
            background: "rgba(244,63,94,0.08)",
            border: "1px solid rgba(244,63,94,0.2)",
          }}
        >
          {submitError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary-glow w-full"
          style={{ opacity: loading ? 0.7 : 1 }}
          aria-busy={loading}
        >
          {loading ? "Starting your quest…" : "Start my quest! 🚀"}
        </button>
        <button
          onClick={() => goTo(2)}
          disabled={loading}
          className="text-sm-sq text-center w-full"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            padding: "8px",
          }}
        >
          ← Edit my details
        </button>
      </div>
    </div>
  );

  const steps = { 1: step1, 2: step2, 3: step3 };

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="3.5" fill="var(--color-accent-violet)" />
            <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-violet)" strokeWidth="1.5" fill="none" />
            <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none" transform="rotate(60 16 16)" />
            <ellipse cx="16" cy="16" rx="13" ry="5.5" stroke="var(--color-accent-cyan)" strokeWidth="1.5" fill="none" transform="rotate(-60 16 16)" />
          </svg>
          <span
            style={{ fontFamily: "var(--font-sora)", fontWeight: 600, fontSize: "16px", color: "var(--color-text-secondary)" }}
          >
            KnowledgeQuest
          </span>
        </div>

        <StepDots step={step} />

        {/* Animated step card */}
        <div
          className="card p-8"
          style={{ overflow: "hidden", minHeight: step === 2 ? undefined : 400 }}
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
