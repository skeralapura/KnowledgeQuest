"use client";

import { useEffect, useRef } from "react";

interface StreakMilestoneModalProps {
  streakDay: number;
  onClose: () => void;
}

const MILESTONE_COPY: Record<number, { emoji: string; title: string; subtitle: string }> = {
  3:   { emoji: "🔥", title: "3-Day Streak!", subtitle: "You're on fire! Three days in a row." },
  7:   { emoji: "⚡", title: "One Week Streak!", subtitle: "A whole week of learning. Keep it up!" },
  14:  { emoji: "🌟", title: "Two Weeks!", subtitle: "Two weeks strong — you're unstoppable!" },
  30:  { emoji: "🏅", title: "30-Day Streak!", subtitle: "A whole month of science. Amazing!" },
  60:  { emoji: "💎", title: "60-Day Streak!", subtitle: "Two months of curiosity. You're a legend!" },
  100: { emoji: "🏆", title: "100-Day Streak!", subtitle: "One hundred days. Truly extraordinary!" },
};

export function StreakMilestoneModal({ streakDay, onClose }: StreakMilestoneModalProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const copy = MILESTONE_COPY[streakDay] ?? {
    emoji: "🔥",
    title: `${streakDay}-Day Streak!`,
    subtitle: "Keep the momentum going!",
  };

  // Fire confetti
  useEffect(() => {
    let cancelled = false;

    async function fireConfetti() {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (cancelled) return;

        // Burst from both sides
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x: 0.2, y: 0.6 },
          colors: ["#7C6EF5", "#2DD4BF", "#F59E0B", "#F43F5E", "#10B981"],
        });
        setTimeout(() => {
          if (!cancelled) {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { x: 0.8, y: 0.6 },
              colors: ["#7C6EF5", "#2DD4BF", "#F59E0B", "#F43F5E", "#10B981"],
            });
          }
        }, 150);
      } catch {
        // canvas-confetti unavailable — not fatal
      }
    }

    fireConfetti();
    btnRef.current?.focus();

    return () => { cancelled = true; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 201,
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "36px 28px",
          width: "min(420px, calc(100vw - 32px))",
          boxShadow: "var(--shadow-card-hover)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 64, lineHeight: 1 }}>{copy.emoji}</div>

        <h2
          id="milestone-title"
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 24,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          {copy.title}
        </h2>

        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 15,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {copy.subtitle}
        </p>

        {/* Streak day badge */}
        <div
          style={{
            background: "rgba(124,110,245,0.15)",
            border: "1px solid var(--color-accent-violet)",
            borderRadius: "var(--radius-pill)",
            padding: "6px 20px",
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 18,
            color: "var(--color-accent-violet)",
          }}
        >
          🔥 {streakDay} days
        </div>

        <button
          ref={btnRef}
          onClick={onClose}
          className="btn-primary-glow"
          style={{ width: "100%", marginTop: 8 }}
        >
          Keep Going!
        </button>
      </div>
    </>
  );
}
