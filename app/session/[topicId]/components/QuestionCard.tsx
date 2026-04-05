"use client";

interface QuestionCardProps {
  question: string;
  format: string;
  isRevealed: boolean;
  flashResult?: "correct" | "wrong" | null;
}

export function QuestionCard({ question, format, isRevealed, flashResult }: QuestionCardProps) {
  const formatLabel: Record<string, string> = {
    multiple_choice: "Multiple Choice",
    fill_blank_numeric: "Fill in the Blank",
    word_problem: "Word Problem",
    ordering: "Ordering",
    true_false_why: "True or False",
    multi_step: "Multi-Step",
  };

  return (
    <div
      className={
        flashResult === "correct"
          ? "answer-flash-correct"
          : flashResult === "wrong"
          ? "answer-flash-wrong"
          : undefined
      }
      style={{
        background: "var(--color-bg-surface)",
        border: `1px solid ${
          flashResult === "correct"
            ? "var(--color-accent-emerald)"
            : flashResult === "wrong"
            ? "var(--color-accent-rose)"
            : "var(--color-border)"
        }`,
        borderRadius: "var(--radius-card)",
        padding: "28px 24px",
        width: "100%",
        opacity: isRevealed ? 0.7 : 1,
        transition: "opacity 300ms ease-out, border-color 300ms ease-out",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: 11,
          fontFamily: "var(--font-dm-sans)",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-accent-violet)",
          background: "rgba(124,110,245,0.12)",
          borderRadius: "var(--radius-pill)",
          padding: "3px 10px",
          marginBottom: 16,
        }}
      >
        {formatLabel[format] ?? format}
      </span>

      <p
        style={{
          fontFamily: "var(--font-sora)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          lineHeight: 1.55,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {question}
      </p>
    </div>
  );
}
