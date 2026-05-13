"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { buildAIUrl } from "@/lib/aiLinks";
import { getAILinkSettings } from "@/lib/storage";
import { saveHistory } from "@/lib/storage";
import { getScoreMessage } from "@/lib/quizEngine";
import type { Question } from "@/types/quiz";
import type { AIProvider } from "@/types/quiz";

function formatAnswer(value: string): string {
  return value.trim();
}

function buildExplainPrompt(question: Question): string {
  const userAnswer = question.skipped
    ? "(skipped)"
    : !question.userAnswer
      ? "(skipped)"
      : Array.isArray(question.userAnswer)
        ? question.userAnswer.join(" | ")
        : question.userAnswer;
  const correctAnswer = Array.isArray(question.answer)
    ? question.answer.join(" | ")
    : question.answer;

  return [
    "I am taking a quiz on this material and was given this question:",
    "",
    `'${question.question}'`,
    "",
    `I chose this as the answer: '${userAnswer}'`,
    "",
    `That answer was ${question.isCorrect ? "correct" : "incorrect"}. The correct answer is '${correctAnswer}'.`,
    "",
    `Explanation shown in quiz: '${question.explanation || "(none)"}'`,
    "",
    "Help me understand why, then give a short trick to avoid this mistake.",
  ].join("\n");
}

// ── REVIEW ITEM ───────────────────────────────────────────────────────────────

function ReviewItem({
  question,
  index,
  onOpenProvider,
}: {
  question: Question;
  index: number;
  onOpenProvider: (provider: AIProvider, prompt: string) => void;
}) {
  const [showExplain, setShowExplain] = useState(false);
  const isSkipped = question.skipped === true;
  const isCorrect = question.isCorrect === true;
  const followUpPrompt = buildExplainPrompt(question);

  const getUserAnswerDisplay = () => {
    if (!question.userAnswer) return "(skipped)";
    if (Array.isArray(question.userAnswer)) {
      return question.userAnswer.map((answer, itemIndex) => `${itemIndex + 1}. ${formatAnswer(answer)}`).join(" · ");
    }
    if (question.type === "MCQ" && typeof question.userAnswer === "string" && question.options[question.userAnswer]) {
      return `${question.userAnswer}) ${question.options[question.userAnswer]}`;
    }
    return String(question.userAnswer);
  };

  const getCorrectDisplay = () => {
    if (Array.isArray(question.answer)) {
      return question.answer.map((answer, itemIndex) => `${itemIndex + 1}. ${formatAnswer(answer)}`).join(" · ");
    }
    if (question.type === "MCQ" && typeof question.answer === "string" && question.options[question.answer]) {
      return `${question.answer}) ${question.options[question.answer]}`;
    }
    return String(question.answer);
  };

  return (
    <div
      className={`
        bg-surface border border-border rounded-md py-3.5 px-4 mb-2
        border-l-2
        ${isSkipped ? "border-l-secondary" : isCorrect ? "border-l-success" : "border-l-error"}
      `}
    >
      <div className="flex items-start gap-2.5">
        <span className={`text-sm font-medium flex-shrink-0 mt-px ${isSkipped ? "text-secondary" : isCorrect ? "text-success" : "text-error"}`}>
          {isSkipped ? "—" : isCorrect ? "✓" : "✗"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary leading-snug">
            Q{index + 1}. {question.question}
          </p>
          <div className="mt-1.5 text-xs text-secondary leading-relaxed">
            <div>{isSkipped ? "Skipped" : `Your answer: ${getUserAnswerDisplay()}`}</div>
            {!isCorrect && !isSkipped && (
              <div className="text-success mt-0.5">Correct: {getCorrectDisplay()}</div>
            )}
          </div>
          {question.explanation && (
            <>
              <button
                onClick={() => setShowExplain((v) => !v)}
                className="block text-xs text-secondary hover:text-primary mt-2
                           transition-colors duration-[150ms]"
              >
                {showExplain ? "▴ Hide explanation" : "▾ Show explanation"}
              </button>
              <div
                className={`text-xs text-secondary leading-relaxed overflow-hidden
                            transition-all duration-[250ms] ease-out
                            ${showExplain ? "max-h-40 mt-1.5" : "max-h-0"}`}
              >
                {question.explanation}
              </div>
              {showExplain && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProvider("chatgpt", followUpPrompt)}
                    className="inline-flex items-center px-2.5 py-1 rounded-md border border-border text-xs text-primary hover:border-secondary transition-colors duration-[150ms]"
                  >
                    Explain in ChatGPT ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProvider("claude", followUpPrompt)}
                    className="inline-flex items-center px-2.5 py-1 rounded-md border border-border text-xs text-primary hover:border-secondary transition-colors duration-[150ms]"
                  >
                    Explain in Claude ↗
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN RESULTS VIEW ─────────────────────────────────────────────────────────

export default function ResultsView() {
  const { state, navigate, retryQuiz, showToast } = useAppStore();
  const { result } = state;
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const [barWidth, setBarWidth] = useState(0);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!result) return;
    // Animate progress bar
    const t = setTimeout(() => setBarWidth(100), 50);
    // Save history once
    if (!savedRef.current) {
      savedRef.current = true;
      const topic = result.questions[0]?.question.split(" ").slice(0, 4).join(" ") ?? "Quiz";
      saveHistory({
        date: new Date().toLocaleDateString(),
        topic,
        score: result.correct,
        total: result.total,
        percentage: result.percentage,
      });
    }
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;

  const { correct, wrong, skipped, total, percentage, questions } = result;
  const correctPct = (correct / total) * 100;
  const wrongPct = (wrong / total) * 100;
  const skipPct = (skipped / total) * 100;
  const message = getScoreMessage(percentage);

  const displayed = filter === "wrong"
    ? questions.filter((q) => !q.isCorrect)
    : questions;

  const handleShare = () => {
    const text = `I scored ${percentage}% on a quiz! (${correct}/${total} correct) — QuizCraft AI`;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard!");
    }).catch(() => showToast("Could not copy"));
  };

  const handleOpenProvider = (provider: AIProvider, prompt: string) => {
    const { url, usedFallback } = buildAIUrl(provider, prompt, getAILinkSettings());
    if (usedFallback) {
      showToast(`Invalid ${provider === "chatgpt" ? "ChatGPT" : "Claude"} chat reference. Opened a new chat.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-content-sm mx-auto px-4 pt-10 pb-20">
      {/* Label */}
      <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-5">
        Results
      </p>

      {/* Score */}
      <div className="mb-2">
        <span
          className="text-[3rem] font-semibold text-primary leading-none"
          aria-live="polite"
        >
          {correct}/{total}
        </span>
        <span className="text-base text-secondary ml-2.5">{percentage}%</span>
      </div>

      {/* Message */}
      <p className="text-base text-secondary italic mb-7">{message}</p>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2.5 mb-5" aria-label="Quiz statistics">
        <span className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-primary">
          ✓ {correct} correct
        </span>
        <span className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-primary">
          ✗ {wrong} wrong
        </span>
        <span className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-primary">
          — {skipped} skipped
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 w-full bg-border rounded-full overflow-hidden mb-8"
        aria-label="Score breakdown"
      >
        <div
          className="h-full flex transition-[width] duration-[400ms] ease-out"
          style={{ width: `${barWidth}%` }}
        >
          <div className="bg-success" style={{ width: `${correctPct}%` }} />
          <div className="bg-error" style={{ width: `${wrongPct}%` }} />
          <div className="bg-secondary" style={{ width: `${skipPct}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center items-center gap-0 mb-10 text-sm">
        {[
          { label: "Try again", action: retryQuiz },
          { label: "New quiz", action: () => navigate("input") },
          { label: "Share", action: handleShare },
        ].map((item, i) => (
          <span key={item.label} className="flex items-center">
            {i > 0 && <span className="text-secondary mx-2.5">·</span>}
            <button
              onClick={item.action}
              className="text-primary hover:text-secondary transition-colors duration-[150ms]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              {item.label}
            </button>
          </span>
        ))}
      </div>

      {/* Review divider */}
      <div className="flex items-center gap-3 mb-5">
        <span className="flex-1 h-px bg-border" />
        <span className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary whitespace-nowrap">
          Review
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Filter */}
      <div className="flex justify-end gap-3 mb-4 text-sm">
        {(["all", "wrong"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`transition-colors duration-[150ms] focus-visible:outline-none
                        focus-visible:ring-2 focus-visible:ring-accent rounded-sm
                        ${filter === f ? "text-primary" : "text-secondary hover:text-primary"}`}
          >
            {f === "all" ? "All" : "Wrong only"}
          </button>
        ))}
      </div>

      {/* Review list */}
      <div aria-label="Question review list">
        {displayed.length === 0 ? (
          <p className="text-sm text-secondary text-center py-6">No questions to show.</p>
        ) : (
          displayed.map((q, i) => (
            <ReviewItem key={q.id} question={q} index={i} onOpenProvider={handleOpenProvider} />
          ))
        )}
      </div>
    </div>
  );
}
