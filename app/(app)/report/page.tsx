"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TopicAttempted {
  topic_id: string;
  topic_name: string;
  attempts: number;
  correct: number;
  mastery_status: string;
}

interface StruggleArea {
  topic_id: string;
  topic_name: string;
  accuracy: number;
  attempts: number;
}

interface WeeklyReport {
  week_start: string;
  topics_attempted: TopicAttempted[];
  topics_mastered: { topic_id: string; topic_name: string }[];
  struggle_areas: StruggleArea[];
  overall_accuracy: number | null;
  total_questions: number;
  streak_at_week_end: number;
  generated_at: string;
}

interface ReportData {
  report: WeeklyReport | null;
  student: { name: string; current_grade: number };
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/report/data")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d: ReportData) => setData(d))
      .catch(() => setError("Couldn't load your report. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "50vh",
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

  const { report, student } = data;

  if (!report) {
    return (
      <EmptyState name={student.name} />
    );
  }

  const weekLabel = formatWeekLabel(report.week_start);
  const accuracyPct = report.overall_accuracy != null
    ? Math.round(report.overall_accuracy * 100)
    : null;

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
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 0" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "var(--font-sora)",
              fontWeight: 700,
              fontSize: 24,
              color: "var(--color-text-primary)",
              margin: "0 0 4px",
            }}
          >
            Weekly Report
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 14,
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            {weekLabel} · {student.name}, Grade {student.current_grade}
          </p>
        </div>

        {/* Stat cards row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <StatCard
            label="Questions"
            value={String(report.total_questions)}
            icon="📝"
            color="var(--color-accent-violet)"
          />
          <StatCard
            label="Accuracy"
            value={accuracyPct != null ? `${accuracyPct}%` : "—"}
            icon="🎯"
            color={
              accuracyPct == null ? "var(--color-text-muted)"
              : accuracyPct >= 70 ? "var(--color-accent-emerald)"
              : accuracyPct >= 40 ? "var(--color-accent-amber)"
              : "var(--color-accent-rose)"
            }
          />
          <StatCard
            label="Mastered"
            value={String(report.topics_mastered.length)}
            icon="🏆"
            color="var(--color-accent-emerald)"
          />
          <StatCard
            label="Streak"
            value={`${report.streak_at_week_end}d`}
            icon="🔥"
            color="var(--color-accent-amber)"
          />
        </div>

        {/* Topics attempted */}
        {report.topics_attempted.length > 0 && (
          <Section title="Topics Practiced" icon="📚">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {report.topics_attempted.map((t) => (
                <TopicRow key={t.topic_id} topic={t} />
              ))}
            </div>
          </Section>
        )}

        {/* Topics mastered */}
        {report.topics_mastered.length > 0 && (
          <Section title="Newly Mastered" icon="🏆">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {report.topics_mastered.map((t) => (
                <span
                  key={t.topic_id}
                  style={{
                    background: "rgba(16,185,129,0.10)",
                    border: "1px solid var(--color-accent-emerald)",
                    borderRadius: "var(--radius-pill)",
                    padding: "4px 12px",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: 13,
                    color: "var(--color-accent-emerald)",
                    fontWeight: 500,
                  }}
                >
                  ✓ {t.topic_name}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Struggle areas */}
        {report.struggle_areas.length > 0 && (
          <Section title="Keep Practising" icon="💪">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {report.struggle_areas.map((a) => (
                <StruggleRow key={a.topic_id} area={a} />
              ))}
            </div>
          </Section>
        )}

        {/* Grade breakdown table */}
        {report.topics_attempted.length > 0 && (
          <Section title="Full Breakdown" icon="📊">
            <GradeTable topics={report.topics_attempted} />
          </Section>
        )}
      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 700,
          fontSize: 22,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 12,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: 15,
          color: "var(--color-text-secondary)",
          margin: "0 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function TopicRow({ topic }: { topic: { topic_name: string; attempts: number; correct: number; mastery_status: string } }) {
  const pct = topic.attempts > 0 ? Math.round((topic.correct / topic.attempts) * 100) : 0;
  const isMastered = topic.mastery_status === "mastered" || topic.mastery_status === "retained";

  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1, fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--color-text-primary)" }}>
        {topic.topic_name}
        {isMastered && <span style={{ marginLeft: 6, fontSize: 13 }}>✓</span>}
      </span>
      <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--color-text-muted)" }}>
        {topic.correct}/{topic.attempts}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: 13,
          color: pct >= 70 ? "var(--color-accent-emerald)" : pct >= 40 ? "var(--color-accent-amber)" : "var(--color-accent-rose)",
          minWidth: 38,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function StruggleRow({ area }: { area: { topic_name: string; accuracy: number; attempts: number } }) {
  const pct = Math.round(area.accuracy * 100);
  return (
    <div
      style={{
        background: "rgba(244,63,94,0.06)",
        border: "1px solid rgba(244,63,94,0.2)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span style={{ flex: 1, fontFamily: "var(--font-dm-sans)", fontSize: 14, color: "var(--color-text-primary)" }}>
        {area.topic_name}
      </span>
      <span style={{ fontFamily: "var(--font-sora)", fontWeight: 600, fontSize: 13, color: "var(--color-accent-rose)" }}>
        {pct}% accuracy
      </span>
    </div>
  );
}

function GradeTable({ topics }: { topics: { topic_name: string; attempts: number; correct: number; mastery_status: string }[] }) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px 80px",
          padding: "10px 14px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-raised)",
        }}
      >
        {["Topic", "Tries", "Correct", "Score"].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: h === "Topic" ? "left" : "right",
            }}
          >
            {h}
          </span>
        ))}
      </div>
      {/* Rows */}
      {topics.map((t, i) => {
        const pct = t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : 0;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px 80px",
              padding: "10px 14px",
              borderBottom: i < topics.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
          >
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--color-text-primary)" }}>
              {t.topic_name}
            </span>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--color-text-secondary)", textAlign: "right" }}>
              {t.attempts}
            </span>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "var(--color-text-secondary)", textAlign: "right" }}>
              {t.correct}
            </span>
            <span
              style={{
                fontFamily: "var(--font-sora)",
                fontWeight: 600,
                fontSize: 13,
                textAlign: "right",
                color: pct >= 70 ? "var(--color-accent-emerald)" : pct >= 40 ? "var(--color-accent-amber)" : "var(--color-accent-rose)",
              }}
            >
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "var(--color-text-muted)",
        fontFamily: "var(--font-dm-sans)",
        fontSize: 15,
      }}
    >
      <span style={{ fontSize: 32 }}>📊</span>
      Compiling your week…
    </div>
  );
}

function EmptyState({ name }: { name: string }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "32px 24px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 48 }}>🌱</span>
      <h2
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 700,
          fontSize: 20,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        No report yet, {name}!
      </h2>
      <p
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 14,
          color: "var(--color-text-secondary)",
          margin: 0,
          maxWidth: 280,
          lineHeight: 1.6,
        }}
      >
        Complete at least one session this week and your report will appear here.
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + "T00:00:00Z");
  const end = new Date(date);
  end.setUTCDate(date.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(date)} – ${fmt(end)}`;
}
