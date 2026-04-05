"use client";

interface SessionSummaryProps {
  topicName: string;
  correct: number;
  total: number;
  totalXP: number;
  newMasteryStatus: string;
  onGoHome: () => void;
  onPlayAgain: () => void;
}

export function SessionSummary({
  topicName,
  correct,
  total,
  totalXP,
  newMasteryStatus,
  onGoHome,
  onPlayAgain,
}: SessionSummaryProps) {
  const pct = Math.round((correct / total) * 100);

  const masteryLabel: Record<string, string> = {
    learning: "Keep practising!",
    mastered: "Mastered! 🏆",
    review_due: "Review due soon",
    retained: "Retained!",
  };

  const emoji = pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        gap: 24,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: 64, lineHeight: 1 }}>{emoji}</div>

      <h1
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 700,
          fontSize: 26,
          color: "var(--color-text-primary)",
          textAlign: "center",
          margin: 0,
        }}
      >
        Session Complete!
      </h1>

      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 15,
          color: "var(--color-text-secondary)",
          textAlign: "center",
          margin: 0,
        }}
      >
        {topicName}
      </p>

      {/* Stats card */}
      <div
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "24px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <StatRow label="Score" value={`${correct} / ${total} (${pct}%)`} />
        <StatRow label="XP earned" value={`+${totalXP} XP`} accent="var(--color-accent-amber)" />
        <StatRow
          label="Topic status"
          value={masteryLabel[newMasteryStatus] ?? newMasteryStatus}
          accent={newMasteryStatus === "mastered" ? "var(--color-accent-emerald)" : undefined}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        <button onClick={onPlayAgain} className="btn-primary-glow" style={{ width: "100%" }}>
          Play Again
        </button>
        <button
          onClick={onGoHome}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "var(--radius-card)",
            background: "transparent",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Back to Quest Board
        </button>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 14,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: 15,
          color: accent ?? "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
