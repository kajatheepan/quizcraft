"use client";

// ── APP STORE (Zustand-free — React Context + useReducer) ─────────────────────
// Using built-in React state management to keep dependencies minimal.
// This file exports a single shared store via module-level state + listeners.

import { useCallback, useEffect, useReducer } from "react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { checkAnswer, prepareQuestions } from "@/lib/quizEngine";
import {
  clearActiveSession,
  getActiveSession,
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
import { buildResultData } from "@/lib/quizEngine";

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
  | { type: "START_QUIZ"; questions: Question[]; settings: QuizSettings }
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
  | { type: "DISCARD_SESSION" };

// ── REDUCER ───────────────────────────────────────────────────────────────────

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
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz: {
          questions: prepared,
          original: action.questions,
          current: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          startTime: Date.now(),
          settings: action.settings,
          answered: false,
        },
        result: null,
      };
    }

    case "ANSWER_QUESTION": {
      const { quiz } = state;
      const q = { ...quiz.questions[quiz.current] };
      // Only block if the question is actually answered (has both userAnswer and isCorrect set)
      // Allow re-answering skipped questions (both userAnswer and isCorrect are null)
      if (q.userAnswer !== null && q.isCorrect !== null) return state;
      const isCorrect = checkAnswer(q, action.response);
      q.userAnswer = action.response;
      q.isCorrect = isCorrect;
      const questions = [...quiz.questions];
      questions[quiz.current] = q;
      return {
        ...state,
        quiz: {
          ...quiz,
          questions,
          answered: true,
          correct: isCorrect ? quiz.correct + 1 : quiz.correct,
          wrong: !isCorrect ? quiz.wrong + 1 : quiz.wrong,
        },
      };
    }

    case "SKIP_QUESTION": {
      const { quiz } = state;
      const currentQuestion = quiz.questions[quiz.current];
      // Only block if the question is actually answered (has both userAnswer and isCorrect set)
      if (currentQuestion.userAnswer !== null && currentQuestion.isCorrect !== null) return state;
      const skippedQuestion = {
        ...currentQuestion,
        userAnswer: null,
        isCorrect: null,
        skipped: true,
      };
      const questions = [...quiz.questions];
      questions[quiz.current] = skippedQuestion;

      const nextSkippedCount = quiz.skipped + 1;

      if (quiz.current < quiz.questions.length - 1) {
        return {
          ...state,
          quiz: {
            ...quiz,
            questions,
            current: quiz.current + 1,
            answered: false,
            skipped: nextSkippedCount,
          },
        };
      }

      const result = buildResultData(questions, quiz.correct, quiz.wrong, nextSkippedCount);

      return {
        ...state,
        view: "results",
        quiz: {
          ...quiz,
          questions,
          skipped: nextSkippedCount,
        },
        result,
      };
    }

    case "NEXT_QUESTION": {
      const { quiz } = state;
      if (quiz.current < quiz.questions.length - 1) {
        return {
          ...state,
          quiz: { ...quiz, current: quiz.current + 1, answered: false },
        };
      }
      // Last question — finish
      const result = buildResultData(
        quiz.questions,
        quiz.correct,
        quiz.wrong,
        quiz.skipped
      );
      return { ...state, view: "results", result };
    }

    case "GOTO_QUESTION": {
      const { quiz } = state;
      const idx = Math.max(0, Math.min(action.index, quiz.questions.length - 1));
      const target = quiz.questions[idx];
      const answered = Boolean(target?.skipped || target?.userAnswer !== null || target?.isCorrect !== null);
      return { ...state, quiz: { ...quiz, current: idx, answered } };
    }

    case "TIMEOUT_QUESTION": {
      const { quiz } = state;
      const currentQuestion = quiz.questions[quiz.current];
      if (currentQuestion.isCorrect !== null) return state;

      const response = action.response ?? null;
      const isCorrect = response !== null ? checkAnswer(currentQuestion, response) : false;

      return {
        ...state,
        quiz: {
          ...quiz,
          questions: quiz.questions.map((question, index) =>
            index === quiz.current
              ? {
                  ...currentQuestion,
                  userAnswer: response,
                  isCorrect,
                  skipped: false,
                  remainingSeconds: 0,
                }
              : question
          ),
          answered: true,
          correct: isCorrect ? quiz.correct + 1 : quiz.correct,
          wrong: !isCorrect ? quiz.wrong + 1 : quiz.wrong,
        },
      };
    }

    case "FINISH_QUIZ": {
      const { quiz } = state;
      const result = buildResultData(
        quiz.questions,
        quiz.correct,
        quiz.wrong,
        quiz.skipped
      );
      return { ...state, view: "results", result };
    }

    case "RETRY_QUIZ": {
      const { quiz } = state;
      const prepared = prepareQuestions(quiz.original, quiz.settings);
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz: {
          ...quiz,
          questions: prepared,
          current: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
          startTime: Date.now(),
          answered: false,
        },
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
      const currentQuestion = quiz.questions[quiz.current];
      return {
        ...state,
        view: "quiz",
        viewHistory: [...state.viewHistory, state.view],
        quiz: {
          ...quiz,
          answered: Boolean(
            currentQuestion?.skipped ||
            currentQuestion?.userAnswer !== null ||
            currentQuestion?.isCorrect !== null
          ),
        },
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
      return { ...state, quiz: { ...quiz, questions } };
    }

    default:
      return state;
  }
}

// ── MODULE-LEVEL SINGLETON ────────────────────────────────────────────────────
// Allows multiple components to share state without Context boilerplate.

type Listener = (state: AppState) => void;
let globalState = initialState;
const listeners = new Set<Listener>();

function buildSessionFromState(state: AppState): QuizSession | null {
  const { quiz } = state;
  if (quiz.questions.length === 0 || state.view === "results") return null;

  const startedAt = new Date(quiz.startTime ?? Date.now()).toISOString();
  const title = quiz.original[0]?.question ?? quiz.questions[0]?.question ?? "Quiz";

  return {
    id: String(quiz.startTime ?? Date.now()),
    title,
    createdAt: startedAt,
    updatedAt: new Date().toISOString(),
    quiz,
  };
}

function syncActiveSession(action: Action, state: AppState) {
  if (action.type === "DISCARD_SESSION" || state.view === "results") {
    clearActiveSession();
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

export function useAppStore() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const listener: Listener = () => forceUpdate();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const navigate = useCallback((view: ViewName) => dispatch({ type: "NAVIGATE", view }), []);
  const navigateBack = useCallback((fallback?: ViewName) => dispatch({ type: "NAVIGATE_BACK", fallback }), []);

  const startQuiz = useCallback((questions: Question[], settings: QuizSettings) =>
    dispatch({ type: "START_QUIZ", questions, settings }), []);

  const answerQuestion = useCallback((response: string | string[]) =>
    dispatch({ type: "ANSWER_QUESTION", response }), []);

  const skipQuestion = useCallback(() => dispatch({ type: "SKIP_QUESTION" }), []);

  const nextQuestion = useCallback(() => dispatch({ type: "NEXT_QUESTION" }), []);
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
  const restoreSavedQuiz = useCallback(() => {
    const session = getActiveSession();
    if (session) dispatch({ type: "RESTORE_SESSION", session });
  }, []);
  const discardSavedQuiz = useCallback(() => dispatch({ type: "DISCARD_SESSION" }), []);

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
export { dispatch };
