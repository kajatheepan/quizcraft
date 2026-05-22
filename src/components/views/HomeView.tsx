"use client";

// Home view: shows CTA to paste a quiz, quick access to the most recent
// in-progress session and a concise history list. Keep UI logic lightweight.

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { copyToClipboard } from "@/lib/clipboard";
import { getShareLinkForQuiz, waitForCachedShareLinkAnimation } from "@/lib/shareLinks";
import { clearHistory, getHistory, getInProgressSessions } from "@/lib/storage";
import type { HistoryEntry, QuizSession, Question } from "@/types/quiz";
import {
  Play,
  Eye,
  Trash2,
  BookOpen,
  CheckCircle,
  Award,
  Sparkles,
  Share2
} from "lucide-react";

export default function HomeView() {
  const { state, navigate, restoreSavedQuiz, discardSavedQuiz, loadResult, showToast } = useAppStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inProgressSessions, setInProgressSessions] = useState<QuizSession[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ quizzesStarted: number; quizzesShared: number } | null>(null);
  const currentView = state.view;

  const refreshSavedData = () => {
    setInProgressSessions(getInProgressSessions());
    setHistory(getHistory());
  };

  useEffect(() => {
    if (currentView === "home") {
      refreshSavedData();
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "home") return;

    const controller = new AbortController();
    fetch("/api/stats", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { quizzesStarted?: number; quizzesShared?: number }) => {
        if (controller.signal.aborted) return;
        setStats({
          quizzesStarted: typeof data.quizzesStarted === "number" ? data.quizzesStarted : 0,
          quizzesShared: typeof data.quizzesShared === "number" ? data.quizzesShared : 0,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStats({ quizzesStarted: 0, quizzesShared: 0 });
        }
      });

    return () => controller.abort();
  }, [currentView]);

  const handleDiscardSavedQuiz = (sessionId: string) => {
    if (!window.confirm("Discard this saved quiz session? Your progress will be lost.")) return;
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


  const handleShareQuiz = async (id: string, questions: Question[], title?: string) => {
    if (sharingId) return;
    if (!questions || questions.length === 0) {
      showToast("Error: No questions found to share.");
      return;
    }
    setSharingId(id);
    try {
      const { url, cacheHit } = await getShareLinkForQuiz(questions, title);
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
      setSharingId(null);
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm("Clear completed quiz history? Saved in-progress quizzes will stay.")) return;
    clearHistory();
    refreshSavedData();
    showToast("History cleared");
  };

  const formatSavedTime = (value: string) => {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };

  const getScoreBadgeClass = (percentage: number): string => {
    if (percentage < 50) return "bg-error/10 text-error border border-error/20";
    if (percentage < 80) return "bg-warning/10 text-warning border border-warning/20";
    return "bg-success/10 text-success border border-success/20";
  };

  const latestSession = inProgressSessions[0] ?? null;

  // Sorting
  const sortedInProgress = [...inProgressSessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt ?? b.date).getTime() - new Date(a.completedAt ?? a.date).getTime()
  );

  return (
    <div className="home-gradient flex flex-col justify-center items-center w-full min-h-[calc(100vh-52px)] px-4 py-12">
      <div className="w-full max-w-content-lg">
        <div className="max-w-content-sm mx-auto flex flex-col items-center text-center mb-10">
          {/* Label */}
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-4 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-accent animate-pulse" />
            Study Smarter
          </p>

          {/* Heading */}
          <h1 className="text-[2.25rem] font-semibold text-primary leading-[1.15] tracking-tight mb-5 sm:text-[3rem]">
            Welcome to<br />QuizCraft Plus
          </h1>

          {/* Body */}
          <p className="text-base text-secondary mb-4 leading-relaxed">
            Already have questions from ChatGPT, Claude, or your notes?
            <br className="hidden sm:block" />
            Paste them here and start practicing instantly.
          </p>

          <p className="mb-6 text-sm font-medium text-primary/90">
            Generate quiz using AI <span className="text-accent">→</span> Paste it here <span className="text-accent">→</span> Practice immediately
          </p>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-secondary">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/85 px-3 py-1.5 shadow-sm">
              <span className="text-accent">{(stats?.quizzesStarted ?? 0).toLocaleString()}</span>
              quizzes started
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/85 px-3 py-1.5 shadow-sm">
              <span className="text-accent">{(stats?.quizzesShared ?? 0).toLocaleString()}</span>
              quizzes shared
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("start-interactive-tutorial"))}
            className="text-xs text-secondary hover:text-primary transition-colors duration-[150ms]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm mb-2"
          >
            How it works
          </button>
        </div>

        {/* Highlighted Top Active Card */}
        {latestSession && (
          <div className="max-w-content-sm mx-auto bg-surface border border-border rounded-xl p-5 mb-8 shadow-card relative overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />
            
            <p className="text-2xs font-semibold tracking-[0.1em] uppercase text-accent mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse" />
              Resume Saved Quiz
            </p>
            <h3 className="text-base font-semibold text-primary truncate">
              {latestSession.title}
            </h3>
            
            {/* Visual Progress Bar */}
            {(() => {
              const current = latestSession.quiz.current + 1;
              const total = latestSession.quiz.questions.length;
              const percent = Math.round((current / total) * 100);
              return (
                <div className="mt-3.5">
                  <div className="flex justify-between items-center text-xs text-secondary font-medium mb-1.5">
                    <span>Question {current} of {total}</span>
                    <span>{percent}% Completed</span>
                  </div>
                  <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                    <div className="bg-accent h-full rounded-full transition-all duration-[300ms]" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })()}

            <p className="text-[11px] text-secondary mt-3">
              Last saved {formatSavedTime(latestSession.updatedAt)}
            </p>
            <div className="flex flex-col gap-2 mt-5 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => restoreSavedQuiz(latestSession.id)}
                className="flex-grow inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all shadow-sm"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Continue Quiz</span>
              </button>
              <button
                type="button"
                disabled={!!sharingId}
                onClick={() => {
                  const questions = latestSession.quiz.original.length > 0
                    ? latestSession.quiz.original
                    : latestSession.quiz.questions;
                  handleShareQuiz(latestSession.id, questions, latestSession.title);
                }}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 border border-border rounded-lg text-sm font-semibold text-secondary hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all disabled:opacity-50"
                title="Share this quiz"
              >
                <Share2 className="h-4 w-4" />
                <span>{sharingId === latestSession.id ? "Sharing..." : "Share"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDiscardSavedQuiz(latestSession.id)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 border border-border rounded-lg text-sm font-semibold text-secondary hover:text-error hover:border-error hover:bg-error/5 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                <span>Discard</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <div className="max-w-content-sm mx-auto mb-10">
          <button
            type="button"
            onClick={() => navigate("input")}
            data-tutorial="home-paste-quiz"
            className="w-full py-4 px-6 bg-accent text-white rounded-xl
                       text-base font-semibold text-center shadow-card
                       hover:opacity-90 active:scale-[0.99]
                       transition-all duration-[150ms] ease-out
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Paste a Quiz →
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-sm text-secondary my-6">
            <span className="flex-1 h-px bg-border" />
            <span>or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          {/* Generate link */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("prompt")}
              className="rounded-sm text-secondary text-sm font-medium hover:text-primary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Don&apos;t have a quiz yet? Generate one with AI →
            </button>
          </div>
        </div>

        {/* Recent & Past Quizzes Section */}
        <div className="max-w-content-md mx-auto mt-16">
          {/* Active practices sub-list */}
          {sortedInProgress.length > 0 && (
            <div className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xs font-semibold tracking-[0.12em] uppercase text-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block animate-pulse" />
                  Active Practices ({sortedInProgress.length})
                </h2>
              </div>
              <div className="flex flex-col border border-border bg-surface rounded-xl divide-y divide-border overflow-hidden shadow-card">
                {sortedInProgress.map((session) => {
                  const current = session.quiz.current + 1;
                  const total = session.quiz.questions.length;
                  const progressPercent = Math.round((current / total) * 100);
                  return (
                    <div key={`session-item-${session.id}`}>
                      {/* Mobile layout */}
                      <div className="flex flex-col gap-2.5 p-4 hover:bg-bg/20 transition-colors duration-150 md:hidden">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BookOpen className="h-4 w-4 text-secondary flex-shrink-0" />
                          <span className="text-sm font-semibold text-primary truncate" title={session.title}>
                            {session.title}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2 mt-1">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-3xs font-bold bg-accent/10 text-accent border border-accent/20">
                                Q{current}/{total}
                              </span>
                              <span className="text-2xs text-secondary font-medium">({progressPercent}%)</span>
                            </div>
                            <span className="text-3xs text-secondary">{formatSavedTime(session.updatedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => restoreSavedQuiz(session.id)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-accent text-white rounded-md text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                              title="Resume quiz"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>Resume</span>
                            </button>
                            <button
                              type="button"
                              disabled={!!sharingId}
                              onClick={() => {
                                const questions = session.quiz.original.length > 0
                                  ? session.quiz.original
                                  : session.quiz.questions;
                                handleShareQuiz(session.id, questions, session.title);
                              }}
                              className="p-1.5 border border-border hover:border-accent hover:bg-accent/5 rounded-md text-secondary hover:text-accent transition-colors disabled:opacity-50"
                              title="Share quiz"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardSavedQuiz(session.id)}
                              className="p-1.5 border border-border hover:border-error hover:bg-error/5 rounded-md text-secondary hover:text-error transition-colors"
                              title="Discard session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div
                        className="hidden md:grid md:grid-cols-12 gap-3 items-center p-4 hover:bg-bg/20 transition-colors duration-150"
                      >
                        {/* Topic Name */}
                        <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                          <BookOpen className="h-4 w-4 text-secondary flex-shrink-0" />
                          <span className="text-sm font-medium text-primary truncate block" title={session.title}>
                            {session.title}
                          </span>
                        </div>

                        {/* Progress Badge */}
                        <div className="md:col-span-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-accent/10 text-accent border border-accent/20">
                            Q{current}/{total}
                          </span>
                          <span className="text-xs text-secondary font-medium">({progressPercent}%)</span>
                        </div>

                        {/* Last Saved Date */}
                        <div className="md:col-span-2 text-xs text-secondary">
                          {formatSavedTime(session.updatedAt)}
                        </div>

                        {/* Row actions */}
                        <div className="md:col-span-3 flex justify-end items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => restoreSavedQuiz(session.id)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-accent text-white rounded-md text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                            title="Resume quiz"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Resume</span>
                          </button>
                          <button
                            type="button"
                            disabled={!!sharingId}
                            onClick={() => {
                              const questions = session.quiz.original.length > 0
                                ? session.quiz.original
                                : session.quiz.questions;
                              handleShareQuiz(session.id, questions, session.title);
                            }}
                            className="p-1.5 border border-border hover:border-accent hover:bg-accent/5 rounded-md text-secondary hover:text-accent transition-colors disabled:opacity-50"
                            title="Share quiz"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDiscardSavedQuiz(session.id)}
                            className="p-1.5 border border-border hover:border-error hover:bg-error/5 rounded-md text-secondary hover:text-error transition-colors"
                            title="Discard session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Practice History list */}
          {sortedHistory.length > 0 && (
            <div className="mb-12">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xs font-semibold tracking-[0.12em] uppercase text-secondary flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-success" />
                  Completed History ({sortedHistory.length})
                </h2>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors focus-visible:outline-none"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Completed</span>
                </button>
              </div>
              <div className="flex flex-col border border-border bg-surface rounded-xl divide-y divide-border overflow-hidden shadow-card">
                {sortedHistory.map((entry, index) => {
                  const scorePercent = entry.percentage;
                  const itemId = entry.id ?? `${entry.date}-${index}`;
                  return (
                    <div key={`history-item-${itemId}`}>
                      {/* Mobile layout */}
                      <div className="flex flex-col gap-2.5 p-4 hover:bg-bg/20 transition-colors duration-150 md:hidden">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                          <span className="text-sm font-semibold text-primary truncate" title={entry.topic}>
                            {entry.topic}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2 mt-1">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-3xs font-bold ${getScoreBadgeClass(scorePercent)}`}>
                                {scorePercent}%
                              </span>
                              <span className="text-2xs text-secondary font-medium">({entry.score}/{entry.total})</span>
                            </div>
                            <span className="text-3xs text-secondary">{formatSavedTime(entry.completedAt ?? entry.date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleReviewFinishedQuiz(entry)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-border bg-surface hover:bg-bg/50 rounded-md text-xs font-semibold text-primary transition-all duration-150 shadow-sm"
                              title="Review results"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Review</span>
                            </button>
                            {entry.result && (
                              <button
                                type="button"
                                disabled={!!sharingId}
                                onClick={() => {
                                  if (entry.result) {
                                    handleShareQuiz(entry.id ?? entry.date, entry.result.questions, entry.topic);
                                  }
                                }}
                                className="p-1.5 border border-border hover:border-accent hover:bg-accent/5 rounded-md text-secondary hover:text-accent transition-colors disabled:opacity-50"
                                title="Share quiz"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div
                        className="hidden md:grid md:grid-cols-12 gap-3 items-center p-4 hover:bg-bg/20 transition-colors duration-150"
                      >
                        {/* Topic Name */}
                        <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                          <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                          <span className="text-sm font-medium text-primary truncate block" title={entry.topic}>
                            {entry.topic}
                          </span>
                        </div>

                        {/* Color Coded Score Badges */}
                        <div className="md:col-span-3 flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold ${getScoreBadgeClass(scorePercent)}`}>
                            {scorePercent}%
                          </span>
                          <span className="text-xs text-secondary font-medium">({entry.score}/{entry.total} correct)</span>
                        </div>

                        {/* Graded Date */}
                        <div className="md:col-span-2 text-xs text-secondary">
                          {formatSavedTime(entry.completedAt ?? entry.date)}
                        </div>

                        {/* Row actions */}
                        <div className="md:col-span-3 flex justify-end items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReviewFinishedQuiz(entry)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-border bg-surface hover:bg-bg/50 rounded-md text-xs font-semibold text-primary transition-all duration-150 shadow-sm"
                            title="Review results"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Review</span>
                          </button>
                          {entry.result && (
                            <button
                              type="button"
                              disabled={!!sharingId}
                              onClick={() => {
                                if (entry.result) {
                                  handleShareQuiz(entry.id ?? entry.date, entry.result.questions, entry.topic);
                                }
                              }}
                              className="p-1.5 border border-border hover:border-accent hover:bg-accent/5 rounded-md text-secondary hover:text-accent transition-colors disabled:opacity-50"
                              title="Share quiz"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type HistoryListItem =
  | { kind: "unfinished"; session: QuizSession; sortTime: number }
  | { kind: "finished"; entry: HistoryEntry; sortTime: number };
