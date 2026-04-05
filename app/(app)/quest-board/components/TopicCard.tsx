"use client";

import { useRouter } from "next/navigation";

export type CardState = "locked" | "available" | "in_progress" | "mastered";

export interface TopicCardProps {
  topicId: string;
  name: string;
  description: string;
  masteryStatus: string | null;
  confidenceScore: number;
  attemptsCount: number;
  enrolledGrade: number;
  topicGrade: number;
  animationDelay: number; // ms
}

function deriveCardState(
  masteryStatus: string | null,
  attemptsCount: number,
  enrolledGrade: number,
  topicGrade: number
): CardState {
  if (masteryStatus === "mastered" || masteryStatus === "retained") return "mastered";
  if (attemptsCount > 0) return "in_progress";
  // Locked if topic grade is more than 1 above enrolled grade
  if (topicGrade > enrolledGrade + 1) return "locked";
  return "available";
}

const STATE_STYLES: Record<CardState, {
  border: string;
  background: string;
  badge: string;
  badgeBg: string;
  icon: string;
  cursor: string;
}> = {
  locked: {
    border: "var(--color-border)",
    background: "var(--color-bg-surface)",
    badge: "var(--color-text-muted)",
    badgeBg: "rgba(74,80,104,0.12)",
    icon: "🔒",
    cursor: "default",
  },
  available: {
    border: "var(--color-accent-violet)",
    background: "var(--color-bg-surface)",
    badge: "var(--color-accent-violet)",
    badgeBg: "rgba(124,110,245,0.10)",
    icon: "▶",
    cursor: "pointer",
  },
  in_progress: {
    border: "var(--color-accent-cyan)",
    background: "var(--color-bg-surface)",
    badge: "var(--color-accent-cyan)",
    badgeBg: "rgba(45,212,191,0.10)",
    icon: "⚡",
    cursor: "pointer",
  },
  mastered: {
    border: "var(--color-accent-emerald)",
    background: "rgba(16,185,129,0.06)",
    badge: "var(--color-accent-emerald)",
    badgeBg: "rgba(16,185,129,0.12)",
    icon: "✓",
    cursor: "pointer",
  },
};

const STATE_LABEL: Record<CardState, string> = {
  locked: "Locked",
  available: "Start",
  in_progress: "Continue",
  mastered: "Mastered",
};

export function TopicCard({
  topicId,
  name,
  masteryStatus,
  confidenceScore,
  attemptsCount,
  enrolledGrade,
  topicGrade,
  animationDelay,
}: TopicCardProps) {
  const router = useRouter();
  const state = deriveCardState(masteryStatus, attemptsCount, enrolledGrade, topicGrade);
  const s = STATE_STYLES[state];
  const isClickable = state !== "locked";

  function handleClick() {
    if (!isClickable) return;
    // Store topic name for session page label
    sessionStorage.setItem(`sq_topic_name_${topicId}`, name);
    router.push(`/session/${topicId}`);
  }

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${name} — ${STATE_LABEL[state]}` : `${name} — Locked`}
      aria-disabled={!isClickable}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      style={{
        background: s.background,
        border: `1.5px solid ${s.border}`,
        borderRadius: "var(--radius-card)",
        padding: "18px 16px",
        cursor: s.cursor,
        opacity: state === "locked" ? 0.5 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "transform 200ms ease-out, box-shadow 200ms ease-out",
        animationDelay: `${animationDelay}ms`,
        animationFillMode: "both",
        animation: `cardEnter 400ms ease-out ${animationDelay}ms both`,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!isClickable) return;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* State badge + icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: s.badge,
            background: s.badgeBg,
            borderRadius: "var(--radius-pill)",
            padding: "2px 8px",
          }}
        >
          <span aria-hidden="true">{s.icon}</span>
          {STATE_LABEL[state]}
        </span>

        {/* Confidence ring for in-progress / mastered */}
        {(state === "in_progress" || state === "mastered") && (
          <ConfidenceRing pct={confidenceScore} state={state} />
        )}
      </div>

      {/* Topic name */}
      <p
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: 14,
          color: state === "locked" ? "var(--color-text-muted)" : "var(--color-text-primary)",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {name}
      </p>

      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}

// Small SVG confidence ring
function ConfidenceRing({ pct, state }: { pct: number; state: CardState }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const color = state === "mastered" ? "var(--color-accent-emerald)" : "var(--color-accent-cyan)";

  return (
    <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx={13} cy={13} r={r} fill="none" stroke="var(--color-bg-raised)" strokeWidth={3} />
      <circle
        cx={13}
        cy={13}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 13 13)"
      />
    </svg>
  );
}
