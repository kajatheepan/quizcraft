"use client";

// ── APP STORE (Zustand-free — React Context + useReducer) ─────────────────────
// Using built-in React state management to keep dependencies minimal.
// This file exports a single shared store via module-level state + listeners.

import { useCallback, useEffect, useReducer } from "react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { checkAnswer, prepareQuestions } from "@/lib/quizEngine";
import type {
  HistoryEntry,
  Question,
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
  | { type: "TIMEOUT_QUESTION" }
  | { type: "NEXT_QUESTION" }
  | { type: "GOTO_QUESTION"; index: number }
  | { type: "FINISH_QUIZ" }
  | { type: "RETRY_QUIZ" }
  | { type: "SET_RAW_TEXT"; text: string }
  | { type: "SET_SETTINGS"; settings: Partial<QuizSettings> }
  | { type: "SHOW_TOAST"; message: string }
  | { type: "CLEAR_TOAST" }
  | { type: "LOAD_RESULT"; result: ResultData }
  | { type: "SET_REMAINING"; index: number; seconds: number };

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
      if (quiz.answered) return state;
      const q = { ...quiz.questions[quiz.current] };
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
      if (quiz.answered) return state;
      const currentQuestion = quiz.questions[quiz.current];
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
      if (quiz.answered) return state;
      const currentQuestion = quiz.questions[quiz.current];
      const timedOutQuestion = {
        ...currentQuestion,
        userAnswer: null,
        isCorrect: false,
        skipped: false,
      };
      const questions = [...quiz.questions];
      questions[quiz.current] = timedOutQuestion;

      return {
        ...state,
        quiz: {
          ...quiz,
          questions,
          answered: true,
          wrong: quiz.wrong + 1,
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

function dispatch(action: Action) {
  globalState = reducer(globalState, action);
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

  const timeoutQuestion = useCallback(() => dispatch({ type: "TIMEOUT_QUESTION" }), []);
  const setRemaining = useCallback((index: number, seconds: number) => dispatch({ type: "SET_REMAINING", index, seconds }), []);

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
  };
}

export type { AppState };
export { dispatch };
