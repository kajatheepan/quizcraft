"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { buildAIUrl } from "@/lib/aiLinks";
import { copyToClipboard } from "@/lib/clipboard";
import { getShareLinkForQuiz, waitForCachedShareLinkAnimation } from "@/lib/shareLinks";
import { getAILinkSettings } from "@/lib/storage";
import { saveHistory } from "@/lib/storage";
import { getScoreMessage } from "@/lib/quizEngine";
import type { Question } from "@/types/quiz";
import type { AIProvider } from "@/types/quiz";
import { Copy } from "lucide-react";

type ReviewFilter = "all" | "review" | "correct" | "wrong" | "skipped";

function getQuestionStatus(question: Question) {
  if (question.status === "timedOut") return "skipped";
  if (question.status) return question.status;
  if (question.isCorrect !== null) return "answered";
  if (question.skipped) return "skipped";
  return "unseen";
}

function formatAnswer(value: string): string {
  return value.trim();
}

function buildExplainPrompt(question: Question): string {
  const userAnswer = getQuestionStatus(question) === "skipped"
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

const ReviewItem = memo(function ReviewItem({
  question,
  index,
  onOpenProvider,
  onCopyPrompt,
}: {
  question: Question;
  index: number;
  onOpenProvider: (provider: AIProvider, prompt: string) => void;
  onCopyPrompt: (prompt: string) => void;
}) {
  const [showExplain, setShowExplain] = useState(false);
  const isSkipped = getQuestionStatus(question) === "skipped";
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
            {!isCorrect && (
              <div className="text-success mt-0.5">Correct: {getCorrectDisplay()}</div>
            )}
          </div>
          {question.explanation && (
            <>
              <button
                type="button"
                onClick={() => setShowExplain((v) => !v)}
                className="block text-xs text-secondary hover:text-primary mt-2
                           transition-colors duration-[150ms] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {showExplain ? "▴ Hide explanation" : "▾ Show explanation"}
              </button>
              {showExplain && (
                <>
                  <div className="mt-3 rounded-md border border-border bg-bg px-3 py-3 animate-fade-in">
                    <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-2">
                      Explanation
                    </p>
                    <MarkdownRenderer content={question.explanation} className="text-sm leading-relaxed" />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenProvider("chatgpt", followUpPrompt)}
                      data-tutorial="results-explain-ai"
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border text-xs text-secondary hover:text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Explain in ChatGPT ↗
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProvider("claude", followUpPrompt)}
                      data-tutorial="results-explain-ai"
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border text-xs text-secondary hover:text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Explain in Claude ↗
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyPrompt(followUpPrompt)}
                      data-tutorial="results-explain-ai"
                      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs text-secondary hover:text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy prompt
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ── MAIN RESULTS VIEW ─────────────────────────────────────────────────────────

export default function ResultsView() {
  const { state, navigate, retryQuiz, showToast } = useAppStore();
  const { result, quiz } = state;
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [barWidth, setBarWidth] = useState(0);
  const [sharingQuiz, setSharingQuiz] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!result) return;
    // Animate progress bar
    const t = setTimeout(() => setBarWidth(100), 50);
    // Save history once
    if (!savedRef.current) {
      savedRef.current = true;
      const topic = quiz.title || (result.questions[0]?.question.split(" ").slice(0, 4).join(" ") ?? "Quiz");
      saveHistory({
        id: String(quiz.startTime ?? Date.now()),
        sessionId: String(quiz.startTime ?? Date.now()),
        date: new Date().toLocaleDateString(),
        completedAt: new Date().toISOString(),
        topic,
        score: result.correct,
        total: result.total,
        percentage: result.percentage,
        result,
      });
    }
    return () => clearTimeout(t);
  }, [result, quiz.startTime, quiz.title]);

  const correct = result?.correct ?? 0;
  const wrong = result?.wrong ?? 0;
  const skipped = result?.skipped ?? 0;
  const total = result?.total ?? 0;
  const percentage = result?.percentage ?? 0;
  const questions = result?.questions ?? [];

  const { correctPct, wrongPct, skipPct } = useMemo(() => ({
    correctPct: total > 0 ? (correct / total) * 100 : 0,
    wrongPct: total > 0 ? (wrong / total) * 100 : 0,
    skipPct: total > 0 ? (skipped / total) * 100 : 0,
  }), [correct, wrong, skipped, total]);

  const displayed = useMemo(() => {
    if (filter === "review") {
      return questions.filter((q) => getQuestionStatus(q) === "skipped" || q.isCorrect === false);
    }
    if (filter === "correct") {
      return questions.filter((q) => getQuestionStatus(q) === "answered" && q.isCorrect === true);
    }
    if (filter === "wrong") {
      return questions.filter((q) => getQuestionStatus(q) === "answered" && q.isCorrect === false);
    }
    if (filter === "skipped") {
      return questions.filter((q) => getQuestionStatus(q) === "skipped");
    }
    return questions;
  }, [filter, questions]);

  if (!result) {
    return (
      <div className="max-w-content-sm mx-auto px-4 pt-12 pb-20">
        <section className="rounded-lg border border-border bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-3">
            Results unavailable
          </p>
          <h1 className="text-xl font-semibold text-primary">No quiz result found</h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            This can happen after old saved data is cleared or refreshed. Paste a quiz to start a new practice session.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("home")}
              className="rounded-md border border-border px-4 py-2 text-sm text-secondary transition-colors duration-[150ms] hover:border-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={() => navigate("input")}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity duration-[150ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Paste a quiz
            </button>
          </div>
        </section>
      </div>
    );
  }

  const message = getScoreMessage(percentage);

  const handleShareScore = async () => {
    // Build a stateless score URL with all params for OG image generation
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const titleEncoded = encodeURIComponent(quiz.title || (result?.questions[0]?.question.slice(0, 60) ?? "Quiz"));
    const scoreUrl = `${siteOrigin}/results/score?t=${titleEncoded}&s=${correct}&n=${total}&pct=${percentage}`;

    const copied = await copyToClipboard(scoreUrl);
    if (copied) {
      showToast("Score link copied to clipboard!");
      return;
    }
    showToast("Copy failed. Select the text and copy manually.");
  };

  const handleShareQuiz = async () => {
    if (sharingQuiz) return;
    setSharingQuiz(true);
    try {
      const sourceQuestions = quiz.original.length > 0
        ? quiz.original
        : result?.questions ?? quiz.questions;
      if (!sourceQuestions || sourceQuestions.length === 0) {
        showToast("Error: No questions found to share.");
        setSharingQuiz(false);
        return;
      }

      const { url, cacheHit } = await getShareLinkForQuiz(sourceQuestions, quiz.title);
      await waitForCachedShareLinkAnimation(cacheHit);
      const copied = await copyToClipboard(url);
      if (copied) {
        showToast(cacheHit ? "Cached sharing link copied!" : "Sharing link copied to clipboard!");
      } else {
        showToast("Could not copy link. Try manual selection.");
      }
    } catch (err) {
      console.error("Failed to share quiz:", err);
      showToast("Error generating sharing link.");
    } finally {
      setSharingQuiz(false);
    }
  };

  const handleOpenProvider = (provider: AIProvider, prompt: string) => {
    const { url, usedFallback } = buildAIUrl(provider, prompt, getAILinkSettings());
    if (usedFallback) {
      showToast(`Could not use that saved ${provider === "chatgpt" ? "ChatGPT" : "Claude"} conversation. Opened a new chat instead.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyPrompt = async (prompt: string) => {
    const copied = await copyToClipboard(prompt);
    if (copied) {
      showToast("Prompt copied to clipboard");
      return;
    }
    showToast("Copy failed. Select the text and copy manually.");
  };

  return (
    <div className="max-w-content-sm mx-auto px-4 pt-10 pb-20">
      <section className="mb-10 rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary">
                Results
              </p>
              <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs font-medium text-secondary">
                {percentage}%
              </span>
            </div>

            <div>
              <span
                className="text-[3rem] font-semibold text-primary leading-none"
                aria-live="polite"
              >
                {correct}/{total}
              </span>
            </div>

            <p className="mt-3 text-base text-secondary italic">{message}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:min-w-[180px]" aria-label="Quiz statistics">
            <span className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-sm text-primary">
              <span className="text-success">✓ Correct</span>
              <span className="font-medium">{correct}</span>
            </span>
            <span className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-sm text-primary">
              <span className="text-error">✗ Wrong</span>
              <span className="font-medium">{wrong}</span>
            </span>
            <span className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-sm text-primary">
              <span className="text-secondary">— Skipped</span>
              <span className="font-medium">{skipped}</span>
            </span>
          </div>
        </div>

        <div
          className="mt-6 h-1 w-full bg-border rounded-full overflow-hidden"
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

        <div className="mt-6 flex flex-wrap justify-center items-center gap-0 text-sm">
          {[
            { label: "Try again", action: retryQuiz, disabled: false },
            { label: "New quiz", action: () => navigate("input"), disabled: false },
            { label: "Share score", action: handleShareScore, disabled: false },
            { label: sharingQuiz ? "Generating link..." : "Share quiz", action: handleShareQuiz, disabled: sharingQuiz },
          ].map((item, i) => (
            <span key={item.label} className="flex items-center">
              {i > 0 && <span className="text-secondary mx-2.5">·</span>}
              <button
                type="button"
                onClick={item.action}
                disabled={item.disabled}
                className={`text-primary hover:text-secondary transition-colors duration-[150ms]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm
                           ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Review divider */}
      <div className="flex items-center gap-3 mb-5">
        <span className="flex-1 h-px bg-border" />
        <span className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary whitespace-nowrap">
          Review
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm sm:justify-end" role="group" aria-label="Review filters">
        {([
          { value: "all", label: "All" },
          { value: "review", label: "Review needed" },
          { value: "correct", label: "Correct" },
          { value: "wrong", label: "Wrong" },
          { value: "skipped", label: "Skipped" },
        ] as const).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={`transition-colors duration-[150ms] focus-visible:outline-none
                        focus-visible:ring-2 focus-visible:ring-accent rounded-sm
                        ${filter === item.value ? "text-primary" : "text-secondary hover:text-primary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Review list */}
      <div aria-label="Question review list">
        {displayed.length === 0 ? (
          <p className="text-sm text-secondary text-center py-6">No questions to show.</p>
        ) : (
          displayed.map((q, i) => (
            <ReviewItem
              key={q.id}
              question={q}
              index={i}
              onOpenProvider={handleOpenProvider}
              onCopyPrompt={handleCopyPrompt}
            />
          ))
        )}
      </div>
    </div>
  );
}
