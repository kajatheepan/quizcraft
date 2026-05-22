import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { getInProgressSessions, getThemeMode, saveThemeMode } from "@/lib/storage";
import type { Question, QuizSession } from "@/types/quiz";

describe("theme mode persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists light, dark, and system theme modes", () => {
    saveThemeMode("light");
    expect(getThemeMode()).toBe("light");

    saveThemeMode("dark");
    expect(getThemeMode()).toBe("dark");

    saveThemeMode("system");
    expect(getThemeMode()).toBe("system");
  });

  it("falls back to system for invalid stored theme mode", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: "sepia" }));

    expect(getThemeMode()).toBe("system");
  });

  it("does not throw when stored app data is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{broken json");

    expect(() => getThemeMode()).not.toThrow();
    expect(getThemeMode()).toBe("system");
  });
});

const baseQuestion: Question = {
  id: 1,
  type: "MCQ",
  question: "Which layer uses frames?",
  options: { A: "Network", B: "Data Link" },
  answer: "B",
  explanation: "The Data Link Layer uses frames.",
  userAnswer: null,
  isCorrect: null,
  status: "unseen",
};

function sessionWithQuestions(questions: Question[]): QuizSession {
  return {
    id: "session-1",
    title: "Saved quiz",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:01:00.000Z",
    status: "in-progress",
    quiz: {
      questions,
      original: questions,
      current: questions.length - 1,
      correct: 1,
      wrong: 0,
      skipped: 1,
      startTime: 1,
      settings: {
        shuffle: false,
        shuffleOptions: false,
        explanationTiming: "after",
        timer: false,
        timerSeconds: 30,
      },
      answered: false,
    },
  };
}

describe("saved quiz sessions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not show a fully finalized quiz as in progress", () => {
    const finalizedSession = sessionWithQuestions([
      { ...baseQuestion, status: "answered", userAnswer: "B", isCorrect: true },
      { ...baseQuestion, id: 2, status: "skipped", skipped: true },
    ]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: [finalizedSession] }));

    expect(getInProgressSessions()).toHaveLength(0);
  });

  it("keeps a quiz resumable while it still has unseen questions", () => {
    const activeSession = sessionWithQuestions([
      { ...baseQuestion, status: "answered", userAnswer: "B", isCorrect: true },
      { ...baseQuestion, id: 2, status: "unseen" },
    ]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: [activeSession] }));

    expect(getInProgressSessions()).toHaveLength(1);
  });
});
