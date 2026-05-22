// ── QUIZ TYPES ────────────────────────────────────────────────────────────────
// Central TypeScript types used across the app. Keep these stable and
// minimal — they form the public shape persisted to localStorage.

export type QuestionType = "MCQ" | "FILL" | "TF";
export type FillMode = "typed" | "dragdrop";
export type QuestionStatus = "unseen" | "answered" | "skipped" | "timedOut";
export type ThemeMode = "system" | "light" | "dark";
export type ExplanationStyle = "short" | "full";
export type PromptMode = "guided" | "format";
export type QuestionStyle = "exam" | "concept" | "hard" | "past";
export type SourceMode = "prefer" | "only";

export interface DragBlank {
  id: string;
  answer: string;
  acceptedAnswers?: string[];
}

/** Represents a single quiz question and its runtime state. */
export interface Question {
  id: number;
  type: QuestionType;
  fillMode?: FillMode;
  question: string;
  options: Record<string, string>; // MCQ only: { A: "...", B: "..." }
  answer: string | string[];
  acceptedAnswers?: string[];
  blanks?: DragBlank[];
  choices?: string[];
  explanation: string;
  userAnswer: string | string[] | null;
  isCorrect: boolean | null;
  status: QuestionStatus;
  skipped?: boolean;
  remainingSeconds?: number;
}

export interface ParseResult {
  title?: string;
  questions: Question[];
  errors: string[];
}

/** Settings controlling quiz behavior (shuffling, timers, explanation timing). */
export interface QuizSettings {
  shuffle: boolean;
  shuffleOptions: boolean;
  explanationTiming: "after" | "end";
  timer: boolean;
  timerSeconds: number;
}

export type AIProvider = "chatgpt" | "claude";
export type AIChatMode = "new" | "continue";

export interface AIProviderLinkConfig {
  mode: AIChatMode;
  conversationRef: string;
}

export interface AILinkSettings {
  chatgpt: AIProviderLinkConfig;
  claude: AIProviderLinkConfig;
}

export type ShareLinkSource = "redis" | "short" | "long";

export interface CachedShareLink {
  url: string;
  createdAt: string;
  source: ShareLinkSource;
}

/** Runtime snapshot of an active quiz round. Persisted inside `QuizSession`. */
export interface QuizState {
  questions: Question[];
  original: Question[];
  current: number;
  correct: number;
  wrong: number;
  skipped: number;
  startTime: number | null;
  settings: QuizSettings;
  answered: boolean;
  title?: string;
}

/** Result payload produced when a quiz completes. */
export interface ResultData {
  questions: Question[];
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  percentage: number;
}

/** A lightweight history entry for completed quizzes shown on the home screen. */
export interface HistoryEntry {
  id?: string;
  sessionId?: string;
  date: string;
  completedAt?: string;
  topic: string;
  score: number;
  total: number;
  percentage: number;
  result?: ResultData;
}

export type QuizSessionStatus = "in-progress" | "completed";

/** An in-progress or completed session containing a full `QuizState`. */
export interface QuizSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status: QuizSessionStatus;
  quiz: QuizState;
}

export interface StoredData {
  lastQuizText?: string;
  preferences?: Partial<QuizSettings>;
  tutorialSeen?: boolean;
  sessions?: QuizSession[];
  activeSession?: QuizSession | null;
  history?: HistoryEntry[];
  aiLinks?: Partial<AILinkSettings>;
  shareLinks?: Record<string, CachedShareLink>;
  themeMode?: ThemeMode;
}

export type ViewName = "home" | "input" | "quiz" | "results" | "prompt";
