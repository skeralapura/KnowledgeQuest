"use client";

import { useEffect, useState } from "react";
import { TopicCard } from "./components/TopicCard";

// ── Types ──────────────────────────────────────────────────────────────────

interface Topic {
  id: string;
  name: string;
  description: string;
  grade: number;
  standard: string;
  subject: string;
}

interface ScoreRow {
  mastery_status: string;
  confidence_score: number;
  attempts_count: number;
  correct_count: number;
}

interface QuestBoardData {
  topics: Topic[];
  scores: Record<string, ScoreRow>;
  student: { current_grade: number; name: string };
}

// Grade labels (Grades 1–8)
const GRADE_LABELS: Record<number, string> = {
  1: "Grade 1",
  2: "Grade 2",
  3: "Grade 3",
  4: "Grade 4",
  5: "Grade 5",
  6: "Grade 6",
  7: "Grade 7",
  8: "Grade 8",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function QuestBoardPage() {
  const [data, setData] = useState<QuestBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/quest-board/data", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d: QuestBoardData) => setData(d))
      .catch(() => setError("Couldn't load topics. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-dm-sans)",
          fontSize: 15,
        }}
      >
        Loading your quests…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-accent-rose)",
          fontFamily: "var(--font-dm-sans)",
          fontSize: 15,
          padding: 24,
          textAlign: "center",
        }}
      >
        {error || "Something went wrong."}
      </div>
    );
  }

  // Group topics by grade
  const byGrade: Record<number, Topic[]> = {};
  for (const topic of data.topics) {
    if (!byGrade[topic.grade]) byGrade[topic.grade] = [];
    byGrade[topic.grade].push(topic);
  }
  const grades = Object.keys(byGrade)
    .map(Number)
    .filter((g) => g >= data.student.current_grade)
    .sort((a, b) => a - b);

  // Compute global card index for stagger delay
  let cardIndex = 0;

  // Count mastered topics — only from visible grades
  const visibleTopics = data.topics.filter((t) => t.grade >= data.student.current_grade);
  const masteredCount = visibleTopics.filter((t) => {
    const s = data.scores[t.id];
    return s && (s.mastery_status === "mastered" || s.mastery_status === "retained");
  }).length;
  const totalTopics = visibleTopics.length;

  return (
    <main
      id="main-content"
      className="page-enter"
      style={{
        background: "var(--color-bg-base)",
        minHeight: "100dvh",
        paddingBottom: 48,
      }}
    >
      {/* Hero header */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "32px 20px 24px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 26,
            color: "var(--color-text-primary)",
            margin: "0 0 6px 0",
          }}
        >
          Quest Board
        </h1>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 14,
            color: "var(--color-text-secondary)",
            margin: "0 0 20px 0",
          }}
        >
          Welcome back, {data.student.name}! You&apos;ve mastered{" "}
          <strong style={{ color: "var(--color-accent-emerald)" }}>{masteredCount}</strong> of{" "}
          {totalTopics} math topics.
        </p>

        {/* Overall progress bar */}
        <div
          style={{
            height: 6,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-bg-raised)",
            overflow: "hidden",
            maxWidth: 320,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round((masteredCount / totalTopics) * 100)}%`,
              borderRadius: "var(--radius-pill)",
              background: "linear-gradient(90deg, var(--color-accent-violet), var(--color-accent-emerald))",
              transition: "width 600ms ease-out",
            }}
          />
        </div>
      </div>

      {/* Grade bands */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>
        {grades.map((grade) => {
          const topics = byGrade[grade];
          const gradeCardStart = cardIndex;
          cardIndex += topics.length;

          return (
            <GradeBand
              key={grade}
              grade={grade}
              label={GRADE_LABELS[grade] ?? `Grade ${grade}`}
              topics={topics}
              scores={data.scores}
              enrolledGrade={data.student.current_grade}
              cardIndexStart={gradeCardStart}
            />
          );
        })}
      </div>
    </main>
  );
}

// ── Grade band section ─────────────────────────────────────────────────────

interface GradeBandProps {
  grade: number;
  label: string;
  topics: Topic[];
  scores: Record<string, ScoreRow>;
  enrolledGrade: number;
  cardIndexStart: number;
}

function GradeBand({ grade, label, topics, scores, enrolledGrade, cardIndexStart }: GradeBandProps) {
  const masteredInBand = topics.filter((t) => {
    const s = scores[t.id];
    return s && (s.mastery_status === "mastered" || s.mastery_status === "retained");
  }).length;

  const isCurrentGrade = grade === enrolledGrade;
  const isFutureGrade = grade > enrolledGrade + 1;

  return (
    <section
      style={{ marginBottom: 36 }}
      aria-labelledby={`grade-label-${grade}`}
    >
      {/* Sticky grade label */}
      <div
        style={{
          position: "sticky",
          top: 56, // below NavBar
          zIndex: 10,
          background: "var(--color-bg-base)",
          paddingTop: 12,
          paddingBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 16,
        }}
      >
        <h2
          id={`grade-label-${grade}`}
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: 15,
            color: isCurrentGrade
              ? "var(--color-accent-violet)"
              : isFutureGrade
              ? "var(--color-text-muted)"
              : "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          {label}
          {isCurrentGrade && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 500,
                background: "rgba(124,110,245,0.15)",
                color: "var(--color-accent-violet)",
                borderRadius: "var(--radius-pill)",
                padding: "2px 8px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                verticalAlign: "middle",
              }}
            >
              Your Grade
            </span>
          )}
        </h2>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          {masteredInBand}/{topics.length} mastered
        </span>
      </div>

      {/* Topic grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {topics.map((topic, i) => {
          const score = scores[topic.id] ?? null;
          return (
            <TopicCard
              key={topic.id}
              topicId={topic.id}
              name={topic.name}
              description={topic.description}
              masteryStatus={score?.mastery_status ?? null}
              confidenceScore={score?.confidence_score ?? 0}
              attemptsCount={score?.attempts_count ?? 0}
              enrolledGrade={enrolledGrade}
              topicGrade={grade}
              animationDelay={(cardIndexStart + i) * 40}
            />
          );
        })}
      </div>
    </section>
  );
}
