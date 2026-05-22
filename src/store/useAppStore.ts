"use client";

// ── APP STORE (Zustand-free — React Context + useReducer) ─────────────────────
// Small, dependency-free global store implemented with a module-level
// singleton and a reducer. This keeps the app simple and easy to reason
// about while remaining testable. Listeners are used to notify components.

import { useCallback, useEffect, useReducer } from "react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { buildResultData, checkAnswer, getQuestionStats, prepareQuestions } from "@/lib/quizEngine";
import { createQuizFingerprint } from "@/lib/shareLinks";
import {
  clearActiveSession,
  getActiveSession,
  getSessionById,
  saveActiveSession,
} from "@/lib/storage";
import type {
  Question,
  QuizSession,
  QuizSettings,
  QuizState,
  ResultData,
  ViewName,
} from "@/types/quiz";

// ── STATE SHAPE ───────────────────────────────────────────────────────────────

interface AppState {
  view: ViewName;
  viewHistory: ViewName[];
  quiz: QuizState;
  result: ResultData | null;
  rawText: string;
  toastMessage: string | null;
  settings: QuizSettings;
}

const initialQuizState: QuizState = {
  questions: [],
  original: [],
  current: 0,
  correct: 0,
  wrong: 0,
  skipped: 0,
  startTime: null,
  settings: DEFAULT_SETTINGS,
  answered: false,
  sessionId: undefined,
};

const initialState: AppState = {
  view: "home",
  viewHistory: [],
  quiz: initialQuizState,
  result: null,
  rawText: "",
  toastMessage: null,
  settings: DEFAULT_SETTINGS,
};

// ── ACTIONS ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "NAVIGATE"; view: ViewName }
  | { type: "NAVIGATE_BACK"; fallback?: ViewName }
  | { type: "START_QUIZ"; questions: Question[]; settings: QuizSettings; title?: string; sessionId?: string }
  | { type: "ANSWER_QUESTION"; response: string | string[] }
  | { type: "SKIP_QUESTION" }
  | { type: "TIMEOUT_QUESTION"; response?: string | string[] | null }
  | { type: "NEXT_QUESTION" }
  | { type: "GOTO_QUESTION"; index: number }
  | { type: "FINISH_QUIZ" }
  | { type: "RETRY_QUIZ" }
  | { type: "SET_RAW_TEXT"; text: string }
  | { type: "SET_SETTINGS"; settings: Partial<QuizSettings> }
  | { type: "SHOW_TOAST"; message: string }
  | { type: "CLEAR_TOAST" }
  | { type: "LOAD_RESULT"; result: ResultData }
  | { type: "SET_REMAINING"; index: number; seconds: number }
  | { type: "RESTORE_SESSION"; session: QuizSession }
  | { type: "DISCARD_SESSION"; sessionId?: string };

// ── REDUCER ───────────────────────────────────────────────────────────────────

function normalizeQuestionState(question: Question): Question {
  if (question.status) return question;
  if (question.isCorrect !== null) return { ...question, status: "answered", skipped: false };
  if (question.skipped) return { ...question, status: "skipped" };
  return { ...question, status: "unseen", skipped: false };
}

function withDerivedStats(quiz: QuizState): QuizState {
  const { correct, wrong, skipped } = getQuestionStats(quiz.questions);
  const currentQuestion = quiz.questions[quiz.current];
  return {
    ...quiz,
    correct,
    wrong,
    skipped,
    answered: currentQuestion?.status === "answered",
  };
}

function markQuestionSkipped(question: Question): Question {
  if (question.status === "answered") return question;
  return {
    ...question,
    userAnswer: null,
    isCorrect: null,
    status: "skipped",
    skipped: true,
  };
}

function hasUsableResponse(response: string | string[] | null | undefined): response is string | string[] {
  if (Array.isArray(response)) {
    return response.some((answer) => answer.trim().length > 0);
  }
  return typeof response === "string" && response.trim().length > 0;
}

function markCurrentSkippedIfNeeded(quiz: QuizState): QuizState {
  const currentQuestion = quiz.questions[quiz.current];
  if (!currentQuestion || currentQuestion.status === "answered" || currentQuestion.status === "timedOut") {
    return withDerivedStats(quiz);
  }

  const questions = [...quiz.questions];
  questions[quiz.current] = markQuestionSkipped(currentQuestion);
  return withDerivedStats({ ...quiz, questions });
}

function finalizeQuizQuestions(quiz: QuizState): QuizState {
  const questions = quiz.questions.map((question) =>
    question.status === "answered" || question.status === "timedOut" ? question : markQuestionSkipped(question)
  );
  return withDerivedStats({ ...quiz, questions });
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NAVIGATE": {
      return {
        ...state,
        view: action.view,
        viewHistory:
          state.view !== action.view
            ? [...state.viewHistory, state.view]
            : state.viewHistory,
      };
    }

    case "NAVIGATE_BACK": {
      const hist = [...state.viewHistory];
      const prev = hist.pop() ?? action.fallback ?? "home";
      return { ...state, view: prev, viewHistory: hist };
    }

    case "START_QUIZ": {
      const prepared = prepareQuestions(action.questions, action.settings);
      const quiz = withDerivedStats({
        questions: prepared,
        original: action.questions,
        current: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        startTime: Date.now(),
        settings: action.settings,
        answered: false,
        title: action.title,
        sessionId: action.sessionId,
        fingerprint: createQuizFingerprint(action.questions),
      });
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz,
        result: null,
      };
    }

    case "ANSWER_QUESTION": {
      const { quiz } = state;
      const q = { ...quiz.questions[quiz.current] };
      if (q.status !== "unseen" && q.status !== "skipped") return state;
      const isCorrect = checkAnswer(q, action.response);
      q.userAnswer = action.response;
      q.isCorrect = isCorrect;
      q.status = "answered";
      q.skipped = false;
      const questions = [...quiz.questions];
      questions[quiz.current] = q;
      return {
        ...state,
        quiz: withDerivedStats({ ...quiz, questions }),
      };
    }

    case "SKIP_QUESTION": {
      const { quiz } = state;
      const nextQuiz = markCurrentSkippedIfNeeded(quiz);

      if (nextQuiz.current < nextQuiz.questions.length - 1) {
        return {
          ...state,
          quiz: withDerivedStats({ ...nextQuiz, current: nextQuiz.current + 1 }),
        };
      }

      const finishedQuiz = finalizeQuizQuestions(nextQuiz);
      const result = buildResultData(finishedQuiz.questions);

      return {
        ...state,
        view: "results",
        quiz: finishedQuiz,
        result,
      };
    }

    case "NEXT_QUESTION": {
      const nextQuiz = markCurrentSkippedIfNeeded(state.quiz);
      if (nextQuiz.current < nextQuiz.questions.length - 1) {
        return {
          ...state,
          quiz: withDerivedStats({ ...nextQuiz, current: nextQuiz.current + 1 }),
        };
      }
      const finishedQuiz = finalizeQuizQuestions(nextQuiz);
      const result = buildResultData(finishedQuiz.questions);
      return { ...state, view: "results", quiz: finishedQuiz, result };
    }

    case "GOTO_QUESTION": {
      const idx = Math.max(0, Math.min(action.index, state.quiz.questions.length - 1));
      if (idx === state.quiz.current) return state;
      const quiz = markCurrentSkippedIfNeeded(state.quiz);
      return { ...state, quiz: withDerivedStats({ ...quiz, current: idx }) };
    }

    case "TIMEOUT_QUESTION": {
      const { quiz } = state;
      const currentQuestion = quiz.questions[quiz.current];
      if (currentQuestion.status === "answered") return state;

      const response = action.response ?? null;
      const hasResponse = hasUsableResponse(response);
      const isCorrect = hasResponse ? checkAnswer(currentQuestion, response) : false;
      const nextQuestion =
        !hasResponse
          ? {
              ...currentQuestion,
              userAnswer: null,
              isCorrect: null,
              status: "timedOut" as const,
              skipped: true,
              remainingSeconds: 0,
            }
          : {
              ...currentQuestion,
              userAnswer: response,
              isCorrect,
              status: "answered" as const,
              skipped: false,
              remainingSeconds: 0,
            };
      const questions = quiz.questions.map((question, index) =>
        index === quiz.current ? nextQuestion : question
      );

      return {
        ...state,
        quiz: withDerivedStats({ ...quiz, questions }),
      };
    }

    case "FINISH_QUIZ": {
      const finishedQuiz = finalizeQuizQuestions(state.quiz);
      const result = buildResultData(finishedQuiz.questions);
      return { ...state, view: "results", quiz: finishedQuiz, result };
    }

    case "RETRY_QUIZ": {
      const { quiz } = state;
      const sourceQuestions = quiz.original.length > 0
        ? quiz.original
        : state.result?.questions ?? quiz.questions;
      if (sourceQuestions.length === 0) return state;
      const prepared = prepareQuestions(sourceQuestions, quiz.settings);
      const nextQuiz = withDerivedStats({
        ...quiz,
        questions: prepared,
        original: sourceQuestions,
        current: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        startTime: Date.now(),
        answered: false,
        sessionId: undefined,
      });
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz: nextQuiz,
        result: null,
      };
    }

    case "SET_RAW_TEXT":
      return { ...state, rawText: action.text };

    case "SET_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case "SHOW_TOAST":
      return { ...state, toastMessage: action.message };

    case "CLEAR_TOAST":
      return { ...state, toastMessage: null };

    case "LOAD_RESULT":
      return { ...state, result: action.result, view: "results" };

    case "RESTORE_SESSION": {
      const { quiz } = action.session;
      const normalizedQuiz = withDerivedStats({
        ...quiz,
        questions: quiz.questions.map(normalizeQuestionState),
      });
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz: normalizedQuiz,
        result: null,
      };
    }

    case "DISCARD_SESSION":
      return {
        ...state,
        quiz: initialQuizState,
        result: null,
      };

    case "SET_REMAINING": {
      const { quiz } = state;
      const { index, seconds } = action;
      if (index < 0 || index >= quiz.questions.length) return state;
      const questions = [...quiz.questions];
      const q = { ...questions[index], remainingSeconds: seconds };
      questions[index] = q;
      return { ...state, quiz: withDerivedStats({ ...quiz, questions }) };
    }

    default:
      return state;
  }
}

// ── MODULE-LEVEL SINGLETON ────────────────────────────────────────────────────
// A tiny pub/sub layer around the reducer so components can `useAppStore()`
// without React Context. This pattern is intentionally simple and suitable
// for small apps where a full state library would be overkill.

type Listener = (state: AppState) => void;
let globalState = initialState;
const listeners = new Set<Listener>();

function buildSessionFromState(state: AppState): QuizSession | null {
  const { quiz } = state;
  if (quiz.questions.length === 0 || state.view === "results") return null;

  const startedAt = new Date(quiz.startTime ?? Date.now()).toISOString();
  const title = quiz.title || (quiz.original[0]?.question ?? quiz.questions[0]?.question ?? "Quiz");
  const sessionId = quiz.sessionId || String(quiz.startTime ?? Date.now());

  return {
    id: sessionId,
    title,
    createdAt: startedAt,
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    quiz,
    fingerprint: quiz.fingerprint,
  };
}

function syncActiveSession(action: Action, state: AppState) {
  if (action.type === "DISCARD_SESSION") {
    clearActiveSession(action.sessionId);
    return;
  }

  if (state.view === "results") {
    clearActiveSession(state.quiz.sessionId || String(state.quiz.startTime ?? ""));
    return;
  }

  const session = buildSessionFromState(state);
  if (session) saveActiveSession(session);
}

function dispatch(action: Action) {
  globalState = reducer(globalState, action);
  syncActiveSession(action, globalState);
  listeners.forEach((l) => l(globalState));
}

// ── HOOK ─────────────────────────────────────────────────────────────────────
// Expose a compact API; consumers receive the current `state` and a set of
// callback actions. All callbacks dispatch into the module-level `dispatch`.
export function useAppStore() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const listener: Listener = () => forceUpdate();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const navigate = useCallback((view: ViewName) => dispatch({ type: "NAVIGATE", view }), []);
  const navigateBack = useCallback((fallback?: ViewName) => dispatch({ type: "NAVIGATE_BACK", fallback }), []);

  const startQuiz = useCallback((questions: Question[], settings: QuizSettings, title?: string, sessionId?: string) => {
    dispatch({ type: "START_QUIZ", questions, settings, title, sessionId });
    // Fire-and-forget: increment the global quiz counter. Never awaited so it
    // never delays or blocks the quiz starting.
    fetch("/api/track", { method: "POST" }).catch(() => {});
  }, []);

  const answerQuestion = useCallback((response: string | string[]) =>
    dispatch({ type: "ANSWER_QUESTION", response }), []);

  const skipQuestion = useCallback(() => dispatch({ type: "SKIP_QUESTION" }), []);

  const nextQuestion = useCallback(() => dispatch({ type: "NEXT_QUESTION" }), []);
  const finishQuiz = useCallback(() => dispatch({ type: "FINISH_QUIZ" }), []);
  const gotoQuestion = useCallback((index: number) => dispatch({ type: "GOTO_QUESTION", index }), []);

  const retryQuiz = useCallback(() => dispatch({ type: "RETRY_QUIZ" }), []);

  const setRawText = useCallback((text: string) =>
    dispatch({ type: "SET_RAW_TEXT", text }), []);

  const setSettings = useCallback((settings: Partial<QuizSettings>) =>
    dispatch({ type: "SET_SETTINGS", settings }), []);

  const showToast = useCallback((message: string) => {
    dispatch({ type: "SHOW_TOAST", message });
    setTimeout(() => dispatch({ type: "CLEAR_TOAST" }), 2000);
  }, []);

  const loadResult = useCallback((result: ResultData) =>
    dispatch({ type: "LOAD_RESULT", result }), []);

  const timeoutQuestion = useCallback((response?: string | string[] | null) =>
    dispatch({ type: "TIMEOUT_QUESTION", response }), []);
  const setRemaining = useCallback((index: number, seconds: number) => dispatch({ type: "SET_REMAINING", index, seconds }), []);
  const restoreSavedQuiz = useCallback((sessionId?: string) => {
    const session = sessionId ? getSessionById(sessionId) : getActiveSession();
    if (session) dispatch({ type: "RESTORE_SESSION", session });
  }, []);
  const discardSavedQuiz = useCallback((sessionId?: string) => dispatch({ type: "DISCARD_SESSION", sessionId }), []);

  return {
    state: globalState,
    navigate,
    navigateBack,
    startQuiz,
    answerQuestion,
    skipQuestion,
    timeoutQuestion,
    setRemaining,
    nextQuestion,
    finishQuiz,
    retryQuiz,
    gotoQuestion,
    setRawText,
    setSettings,
    showToast,
    loadResult,
    restoreSavedQuiz,
    discardSavedQuiz,
  };
}

export type { AppState };
export const __test__ = { reducer, initialState };
export { dispatch };
