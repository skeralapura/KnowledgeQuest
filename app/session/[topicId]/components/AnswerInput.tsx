"use client";

import { useState } from "react";

interface AnswerInputProps {
  format: string;
  choices?: string[]; // for multiple_choice — parsed from question text or passed explicitly
  disabled: boolean;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
}

export function AnswerInput({ format, choices, disabled, onSubmit, onSkip }: AnswerInputProps) {
  const [selected, setSelected] = useState<string>("");
  const [textValue, setTextValue] = useState("");

  function handleSubmit() {
    const answer = format === "fill_blank_numeric" || format === "word_problem" || format === "multi_step"
      ? textValue.trim()
      : selected;
    if (!answer) return;
    onSubmit(answer);
  }

  if (format === "multiple_choice" || format === "ordering" || format === "true_false_why") {
    const options = choices && choices.length > 0
      ? choices
      : format === "true_false_why"
        ? ["True", "False"]
        : [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        {options.map((opt) => (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => !disabled && setSelected(opt)}
            style={{
              textAlign: "left",
              background: selected === opt ? "rgba(124,110,245,0.18)" : "var(--color-bg-raised)",
              border: `1.5px solid ${selected === opt ? "var(--color-accent-violet)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-card)",
              color: selected === opt ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              fontWeight: selected === opt ? 600 : 400,
              padding: "14px 18px",
              cursor: disabled ? "default" : "pointer",
              transition: "all 150ms ease-out",
            }}
          >
            {opt}
          </button>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={handleSubmit}
            disabled={disabled || !selected}
            className="btn-primary-glow"
            style={{ flex: 1, opacity: disabled || !selected ? 0.5 : 1 }}
          >
            Submit
          </button>
          <button
            onClick={onSkip}
            disabled={disabled}
            style={{
              padding: "12px 18px",
              borderRadius: "var(--radius-card)",
              background: "transparent",
              border: `1px solid var(--color-border)`,
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 14,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // fill_blank_numeric / word_problem / multi_step — text input
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <input
        type={format === "fill_blank_numeric" ? "number" : "text"}
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && handleSubmit()}
        disabled={disabled}
        placeholder={format === "fill_blank_numeric" ? "Enter a number…" : "Type your answer…"}
        style={{
          background: "var(--color-bg-raised)",
          border: `1.5px solid var(--color-border)`,
          borderRadius: "var(--radius-card)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-dm-sans)",
          fontSize: 16,
          padding: "14px 16px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSubmit}
          disabled={disabled || !textValue.trim()}
          className="btn-primary-glow"
          style={{ flex: 1, opacity: disabled || !textValue.trim() ? 0.5 : 1 }}
        >
          Submit
        </button>
        <button
          onClick={onSkip}
          disabled={disabled}
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-card)",
            background: "transparent",
            border: `1px solid var(--color-border)`,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 14,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
