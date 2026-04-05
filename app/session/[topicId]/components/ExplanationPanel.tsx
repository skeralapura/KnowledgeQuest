"use client";

import { useEffect, useRef } from "react";

interface ExplanationPanelProps {
  isCorrect: boolean;
  explanation: string;
  correctAnswer: string;
  xpDelta: number;
  masteryBonus: boolean;
  newMasteryStatus: string;
  isVisible: boolean;
  onNext: () => void;
  isLast: boolean;
}

export function ExplanationPanel({
  isCorrect,
  explanation,
  correctAnswer,
  xpDelta,
  masteryBonus,
  newMasteryStatus,
  isVisible,
  onNext,
  isLast,
}: ExplanationPanelProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isVisible) {
      // slight delay so slide animation can start first
      const t = setTimeout(() => btnRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isVisible]);

  const accent = isCorrect ? "var(--color-accent-emerald)" : "var(--color-accent-rose)";
  const bgAccent = isCorrect ? "rgba(16,185,129,0.10)" : "rgba(244,63,94,0.10)";

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--color-bg-surface)",
        borderTop: `1px solid var(--color-border)`,
        padding: "24px 20px",
        transform: isVisible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 300ms ease-out",
        zIndex: 50,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {/* Result badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: bgAccent,
          border: `1px solid ${accent}`,
          borderRadius: "var(--radius-pill)",
          padding: "4px 14px",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 16 }}>{isCorrect ? "✓" : "✗"}</span>
        <span
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 14,
            color: accent,
          }}
        >
          {isCorrect ? "Correct!" : `Answer: ${correctAnswer}`}
        </span>
      </div>

      {/* Explanation */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 14,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          margin: "0 0 16px 0",
        }}
      >
        {explanation}
      </p>

      {/* XP row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--color-accent-amber)",
          }}
        >
          +{xpDelta} XP
        </span>
        {masteryBonus && (
          <span
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
              color: "var(--color-accent-violet)",
              background: "rgba(124,110,245,0.12)",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px",
            }}
          >
            Mastery Bonus!
          </span>
        )}
        {newMasteryStatus === "mastered" && (
          <span style={{ fontSize: 16 }}>🏆</span>
        )}
      </div>

      {/* Next button */}
      <button
        ref={btnRef}
        onClick={onNext}
        className="btn-primary-glow"
        style={{ width: "100%" }}
      >
        {isLast ? "Finish Session" : "Next Question →"}
      </button>
    </div>
  );
}
