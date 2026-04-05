"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ProgressBar } from "./components/ProgressBar";
import { QuestionCard } from "./components/QuestionCard";
import { AnswerInput } from "./components/AnswerInput";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { XPFloat } from "./components/XPFloat";
import { SessionSummary } from "./components/SessionSummary";
import { StreakMilestoneModal } from "@/app/components/StreakMilestoneModal";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuestionData {
  question: string;
  choices?: string[];
  correct_answer: string;
  explanation: string;
  difficulty_delivered: number;
  format: string;
  question_hash: string;
  is_fallback?: boolean;
}

interface AnswerResult {
  is_correct: boolean;
  explanation: string;
  xp_delta: number;
  mastery_bonus: boolean;
  new_mastery_status: string;
  new_difficulty_offset: number;
  next_question_hint: { topic_id: string; difficulty: number; effective_grade: number };
}

interface AttemptRecord {
  isCorrect: boolean;
  xpDelta: number;
  masteryStatus: string;
}

const SESSION_LENGTH = 10;


// ── Component ──────────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams();
  const topicId = params?.topicId as string;

  // ── Session state ──────────────────────────────────────────────────────
  const [topicName, setTopicName] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0); // 0-based
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Answer state ───────────────────────────────────────────────────────
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [flashResult, setFlashResult] = useState<"correct" | "wrong" | null>(null);

  // ── Session tracking ───────────────────────────────────────────────────
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [xpFloatTrigger, setXpFloatTrigger] = useState(0);
  const [xpFloatValue, setXpFloatValue] = useState(0);
  const [lastMasteryStatus, setLastMasteryStatus] = useState("learning");
  const [difficultyOffset, setDifficultyOffset] = useState(0);
  const [excludedHashes, setExcludedHashes] = useState<string[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [milestoneDayModal, setMilestoneDayModal] = useState<number | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  // ── Timer ──────────────────────────────────────────────────────────────
  const questionShownAt = useRef<number>(0);

  // ── sessionStorage key for this topic ─────────────────────────────────
  const sessionKey = topicId ? `sq_session_${topicId}` : null;

  // ── Save session state to sessionStorage ──────────────────────────────
  function saveSessionState(
    index: number,
    offset: number,
    excluded: string[],
    xp: number,
    attemptsArr: AttemptRecord[],
    masteryStatus: string,
    sid: string,
  ) {
    if (!sessionKey) return;
    sessionStorage.setItem(sessionKey, JSON.stringify({
      questionIndex: index,
      difficultyOffset: offset,
      excludedHashes: excluded,
      totalXP: xp,
      attempts: attemptsArr,
      lastMasteryStatus: masteryStatus,
      sessionId: sid,
    }));
  }

  // ── Clear saved session state ──────────────────────────────────────────
  function clearSessionState() {
    if (sessionKey) sessionStorage.removeItem(sessionKey);
  }

  // ── Load topic name + restore session state on mount ──────────────────
  useEffect(() => {
    const storedName = sessionStorage.getItem(`sq_topic_name_${topicId}`);
    setTopicName(storedName ?? topicId ?? "Topic");
  }, [topicId]);

  // ── Fetch question ─────────────────────────────────────────────────────
  const fetchQuestion = useCallback(
    async (offset: number, excluded: string[]) => {
      setIsLoading(true);
      setLoadError("");
      setAnswerResult(null);
      setShowExplanation(false);
      setFlashResult(null);

      try {
        const effectiveGrade = Math.max(1, Math.min(8, Math.round(1 + offset)));
        const difficulty = Math.max(1, Math.min(10, Math.round(5 + offset)));
        const res = await fetch("/api/generate-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic_id: topicId,
            format: "multiple_choice",
            difficulty,
            effective_grade: effectiveGrade,
            excluded_hashes: excluded,
          }),
        });

        if (res.status === 429) {
          setLoadError("You've been on a roll! Take a short break and come back.");
          return;
        }
        if (!res.ok) {
          setLoadError("Couldn't load a question. Please try again.");
          return;
        }

        const data: QuestionData = await res.json();
        setCurrentQuestion(data);
        questionShownAt.current = Date.now();
      } catch {
        setLoadError("Network error. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    },
    [topicId]
  );

  // Initial load — restore session state if available
  useEffect(() => {
    if (!topicId) return;
    const saved = sessionKey ? sessionStorage.getItem(sessionKey) : null;
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setQuestionIndex(state.questionIndex ?? 0);
        setDifficultyOffset(state.difficultyOffset ?? 0);
        setExcludedHashes(state.excludedHashes ?? []);
        setTotalXP(state.totalXP ?? 0);
        setAttempts(state.attempts ?? []);
        setLastMasteryStatus(state.lastMasteryStatus ?? "learning");
        if (state.sessionId) sessionIdRef.current = state.sessionId;
        fetchQuestion(state.difficultyOffset ?? 0, state.excludedHashes ?? []);
        return;
      } catch {
        // Corrupted state — start fresh
        clearSessionState();
      }
    }
    fetchQuestion(0, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  // ── Submit answer ──────────────────────────────────────────────────────
  async function handleSubmit(studentAnswer: string, skipped = false) {
    if (!currentQuestion || isSubmitting) return;
    setIsSubmitting(true);

    const timeMs = Date.now() - questionShownAt.current;

    try {
      const res = await fetch("/api/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topicId,
          question_hash: currentQuestion.question_hash,
          question_format: currentQuestion.format,
          difficulty_delivered: currentQuestion.difficulty_delivered,
          student_answer: studentAnswer,
          correct_answer: currentQuestion.correct_answer,
          question_text: currentQuestion.question,
          current_difficulty_offset: difficultyOffset,
          time_to_answer_ms: timeMs,
          was_skipped: skipped,
        }),
      });

      if (!res.ok) {
        // Non-fatal: show generic feedback
        setAnswerResult({
          is_correct: false,
          explanation: "Something went wrong — try the next question!",
          xp_delta: 0,
          mastery_bonus: false,
          new_mastery_status: lastMasteryStatus,
          new_difficulty_offset: difficultyOffset,
          next_question_hint: { topic_id: topicId, difficulty: 5, effective_grade: 1 },
        });
      } else {
        const result: AnswerResult = await res.json();
        setAnswerResult(result);
        setFlashResult(result.is_correct ? "correct" : "wrong");

        // Update session tracking
        setTotalXP((prev) => prev + result.xp_delta);
        setXpFloatValue(result.xp_delta);
        setXpFloatTrigger((prev) => prev + 1);
        setLastMasteryStatus(result.new_mastery_status);
        setDifficultyOffset(result.new_difficulty_offset);
        setExcludedHashes((prev) => [...prev, currentQuestion.question_hash]);
        setAttempts((prev) => [
          ...prev,
          {
            isCorrect: result.is_correct,
            xpDelta: result.xp_delta,
            masteryStatus: result.new_mastery_status,
          },
        ]);
      }

      setShowExplanation(true);
    } catch {
      setAnswerResult({
        is_correct: false,
        explanation: "Network error — let's keep going!",
        xp_delta: 0,
        mastery_bonus: false,
        new_mastery_status: lastMasteryStatus,
        new_difficulty_offset: difficultyOffset,
        next_question_hint: { topic_id: topicId, difficulty: 5, effective_grade: 1 },
      });
      setShowExplanation(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSkip() {
    handleSubmit("", true);
  }

  // ── Advance to next question ───────────────────────────────────────────
  async function handleNext() {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= SESSION_LENGTH) {
      clearSessionState();
      setSessionDone(true);
      // Process streak — fire and forget, show milestone if needed
      try {
        const res = await fetch("/api/session-end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            questions_answered: nextIndex, // all SESSION_LENGTH answered
          }),
        });
        if (res.ok) {
          const streakData = await res.json();
          if (streakData.is_milestone && streakData.milestone_day) {
            setMilestoneDayModal(streakData.milestone_day);
          }
        }
      } catch {
        // Non-fatal — streak update failure doesn't block UI
      }
      return;
    }
    setQuestionIndex(nextIndex);
    saveSessionState(
      nextIndex,
      difficultyOffset,
      excludedHashes,
      totalXP,
      attempts,
      lastMasteryStatus,
      sessionIdRef.current,
    );
    fetchQuestion(difficultyOffset, excludedHashes);
  }

  // ── Exit session ───────────────────────────────────────────────────────
  async function handleExit() {
    // Update streak if student answered enough questions mid-session
    if (attempts.length >= 5) {
      try {
        await fetch("/api/session-end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionIdRef.current,
            questions_answered: attempts.length,
          }),
        });
      } catch {
        // Non-fatal
      }
    }
    window.location.href = "/quest-board";
  }

  // ── Session done ───────────────────────────────────────────────────────
  if (sessionDone) {
    const correctCount = attempts.filter((a) => a.isCorrect).length;
    return (
      <main style={{ background: "var(--color-bg-base)", minHeight: "100dvh" }}>
        <SessionSummary
          topicName={topicName}
          correct={correctCount}
          total={attempts.length}
          totalXP={totalXP}
          newMasteryStatus={lastMasteryStatus}
          onGoHome={() => { window.location.href = "/quest-board"; }}
          onPlayAgain={() => {
            clearSessionState();
            setSessionDone(false);
            setQuestionIndex(0);
            setAttempts([]);
            setTotalXP(0);
            setExcludedHashes([]);
            setDifficultyOffset(0);
            sessionIdRef.current = crypto.randomUUID();
            fetchQuestion(0, []);
          }}
        />
        {milestoneDayModal !== null && (
          <StreakMilestoneModal
            streakDay={milestoneDayModal}
            onClose={() => setMilestoneDayModal(null)}
          />
        )}
      </main>
    );
  }

  const choices = currentQuestion?.choices ?? [];
  const isLast = questionIndex === SESSION_LENGTH - 1;

  return (
    <main
      style={{
        background: "var(--color-bg-base)",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          padding: "20px 16px 160px", // bottom pad for slide-up panel
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Progress bar */}
        <ProgressBar
          current={questionIndex + 1}
          total={SESSION_LENGTH}
          topicName={topicName}
          onExit={handleExit}
        />

        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: 40,
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 14,
            }}
          >
            Loading question…
          </div>
        )}

        {/* Error state */}
        {loadError && !isLoading && (
          <div
            style={{
              background: "rgba(244,63,94,0.08)",
              border: "1px solid var(--color-accent-rose)",
              borderRadius: "var(--radius-card)",
              padding: "20px 24px",
              color: "var(--color-accent-rose)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 14,
            }}
          >
            {loadError}
            <button
              onClick={() => fetchQuestion(difficultyOffset, excludedHashes)}
              style={{
                display: "block",
                marginTop: 12,
                background: "none",
                border: "none",
                color: "var(--color-accent-violet)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Question + answer */}
        {!isLoading && !loadError && currentQuestion && (
          <>
            <QuestionCard
              question={currentQuestion.question}
              format={currentQuestion.format}
              isRevealed={showExplanation}
              flashResult={flashResult}
            />

            <AnswerInput
              format={currentQuestion.format}
              choices={choices}
              disabled={showExplanation || isSubmitting}
              onSubmit={handleSubmit}
              onSkip={handleSkip}
            />
          </>
        )}
      </div>

      {/* XP float animation */}
      <XPFloat xpDelta={xpFloatValue} trigger={xpFloatTrigger} />

      {/* Explanation slide-up */}
      {answerResult && (
        <ExplanationPanel
          isCorrect={answerResult.is_correct}
          explanation={answerResult.explanation}
          correctAnswer={currentQuestion?.correct_answer ?? ""}
          xpDelta={answerResult.xp_delta}
          masteryBonus={answerResult.mastery_bonus}
          newMasteryStatus={answerResult.new_mastery_status}
          isVisible={showExplanation}
          onNext={handleNext}
          isLast={isLast}
        />
      )}
    </main>
  );
}
