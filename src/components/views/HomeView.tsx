"use client";

// Home view: shows CTA to paste a quiz, quick access to the most recent
// in-progress session and a concise history list. Keep UI logic lightweight.

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { clearHistory, getHistory, getInProgressSessions } from "@/lib/storage";
import type { HistoryEntry, QuizSession } from "@/types/quiz";

type HistoryListItem =
  | { kind: "unfinished"; session: QuizSession; sortTime: number }
  | { kind: "finished"; entry: HistoryEntry; sortTime: number };

export default function HomeView() {
  const { navigate, restoreSavedQuiz, discardSavedQuiz, loadResult, showToast } = useAppStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inProgressSessions, setInProgressSessions] = useState<QuizSession[]>([]);

  const refreshSavedData = () => {
    setInProgressSessions(getInProgressSessions());
    setHistory(getHistory());
  };

  useEffect(() => {
    refreshSavedData();
  }, []);

  const handleDiscardSavedQuiz = (sessionId: string) => {
    discardSavedQuiz(sessionId);
    refreshSavedData();
    showToast("Saved quiz discarded");
  };

  const handleReviewFinishedQuiz = (entry: HistoryEntry) => {
    if (!entry.result) {
      showToast("Review data is not available for this older attempt");
      return;
    }
    loadResult(entry.result);
  };

  const handleClearHistory = () => {
    if (!window.confirm("Clear completed quiz history? Saved in-progress quizzes will stay.")) return;
    clearHistory();
    refreshSavedData();
    showToast("History cleared");
  };

  const formatSavedTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const latestSession = inProgressSessions[0] ?? null;
  const historyItems: HistoryListItem[] = [
    ...inProgressSessions.map((session) => ({
      kind: "unfinished" as const,
      session,
      sortTime: new Date(session.updatedAt).getTime(),
    })),
    ...history.map((entry) => ({
      kind: "finished" as const,
      entry,
      sortTime: new Date(entry.completedAt ?? entry.date).getTime(),
    })),
  ].sort((a, b) => b.sortTime - a.sortTime);

  return (
    <div className="home-gradient flex flex-col justify-center items-center w-full min-h-[calc(100vh-52px)] px-4 py-12">
      <div className="w-full max-w-content-sm">
        {/* Label */}
        <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-4">
          Study Smarter
        </p>

      {/* Heading */}
      <h1 className="text-[2rem] font-semibold text-primary leading-[1.15] tracking-tight mb-5 sm:text-[2.5rem]">
        Welcome to<br />QuizCraft Plus
      </h1>

      {/* Body */}
      <p className="text-base text-secondary mb-4 leading-relaxed">
        Already have questions from ChatGPT, Claude, or your notes?
        <br className="hidden sm:block" />
        Paste them here and start practicing instantly.
      </p>

      <p className="mb-9 text-sm font-medium text-primary/90">
        Generate quiz using AI <span className="text-accent">→</span> Paste it here <span className="text-accent">→</span> Practice immediately
      </p>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("start-interactive-tutorial"))}
        className="self-start text-xs text-secondary hover:text-primary transition-colors duration-[150ms]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm mb-6"
      >
        How it works
      </button>

      {latestSession && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-5 shadow-card">
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-2">
            Saved quiz
          </p>
          <p className="text-sm font-medium text-primary truncate">
            {latestSession.title}
          </p>
          <p className="text-xs text-secondary mt-1">
            Question {latestSession.quiz.current + 1} of {latestSession.quiz.questions.length}
            {" · "}
            Last saved {formatSavedTime(latestSession.updatedAt)}
          </p>
          <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => restoreSavedQuiz(latestSession.id)}
              className="flex-1 py-2.5 px-4 bg-accent text-white rounded-md text-sm font-medium
                         hover:opacity-90 transition-opacity duration-[150ms]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Continue quiz
            </button>
            <button
              type="button"
              onClick={() => handleDiscardSavedQuiz(latestSession.id)}
              className="py-2.5 px-4 border border-border rounded-md text-sm text-secondary
                         hover:text-primary hover:border-secondary transition-colors duration-[150ms]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => navigate("input")}
        data-tutorial="home-paste-quiz"
        className="w-full py-3.5 px-5 bg-accent text-white rounded-lg
                   text-base font-medium text-center shadow-card
                   hover:opacity-90 active:scale-[0.99]
                   transition-all duration-[150ms] ease-out
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
                   mb-6"
      >
        Paste a Quiz →
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 text-sm text-secondary mb-6">
        <span className="flex-1 h-px bg-border" />
        <span>or</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Generate link */}
      <div className="text-center mb-12">
        <button
          type="button"
          onClick={() => navigate("prompt")}
          className="rounded-sm text-secondary text-base hover:text-primary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Don&apos;t have a quiz yet? Generate one with AI →
        </button>
      </div>

      {/* Recent sessions */}
      {historyItems.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary">
              History
            </p>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-sm text-xs text-secondary transition-colors duration-[150ms] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear history
              </button>
            )}
          </div>
          {historyItems.map((item, index) => {
            if (item.kind === "unfinished") {
              const { session } = item;
              return (
                <div
                  key={`unfinished-${session.id}`}
                  aria-label={`${session.title} unfinished quiz`}
                  className={`
                    flex flex-col gap-2 py-3 border-border sm:flex-row sm:items-center sm:justify-between
                    border-b ${index === 0 ? "border-t" : ""} stagger-item
                  `}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="min-w-0 sm:max-w-[60%]">
                    <span className="text-sm font-medium text-primary truncate block">
                      {session.title}
                    </span>
                    <span className="text-xs text-secondary block mt-0.5">
                      Unfinished · Q{session.quiz.current + 1}/{session.quiz.questions.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-secondary">{formatSavedTime(session.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={() => restoreSavedQuiz(session.id)}
                      className="text-xs text-accent hover:opacity-80 transition-opacity duration-[150ms]
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiscardSavedQuiz(session.id)}
                      className="text-xs text-secondary hover:text-primary transition-colors duration-[150ms]
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            }

            const { entry } = item;
              return (
              <div
                key={`finished-${entry.id ?? `${entry.date}-${index}`}`}
                aria-label={`${entry.topic} finished quiz`}
                className={`
                  flex flex-col gap-2 py-3 border-border sm:flex-row sm:items-center sm:justify-between
                  border-b ${index === 0 ? "border-t" : ""} stagger-item
                `}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="text-sm font-medium text-primary truncate sm:max-w-[52%]">
                  {entry.topic}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm text-secondary">{entry.score}/{entry.total}</span>
                  <span className="text-sm font-medium text-success">{entry.percentage}%</span>
                  <span className="text-xs text-secondary">{entry.date}</span>
                  <button
                    type="button"
                    onClick={() => handleReviewFinishedQuiz(entry)}
                    className="text-xs text-accent hover:opacity-80 transition-opacity duration-[150ms]
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  >
                    Review
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
