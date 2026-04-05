"use client";

interface ProgressBarProps {
  current: number; // 1-based question number
  total: number;
  topicName: string;
  onExit: () => void;
}

export function ProgressBar({ current, total, topicName, onExit }: ProgressBarProps) {
  const pct = Math.round(((current - 1) / total) * 100);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          aria-label="Exit session"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "14px",
            padding: "4px 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span aria-hidden="true">←</span> Exit
        </button>

        <span
          className="text-xs-sq"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label={`Question ${current} of ${total}`}
        >
          {current} / {total}
        </span>

        <span
          className="text-xs-sq"
          style={{
            color: "var(--color-accent-violet)",
            fontFamily: "var(--font-sora)",
            fontWeight: 600,
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={topicName}
        >
          {topicName}
        </span>
      </div>

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 6,
          borderRadius: "var(--radius-pill)",
          background: "var(--color-bg-raised)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "var(--radius-pill)",
            background:
              "linear-gradient(90deg, var(--color-accent-violet), var(--color-accent-cyan))",
            transition: "width 400ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
