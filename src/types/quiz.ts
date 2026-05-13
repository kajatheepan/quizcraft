// ── QUIZ TYPES ────────────────────────────────────────────────────────────────

export type QuestionType = "MCQ" | "FILL" | "TF";
export type FillMode = "typed" | "dragdrop";

export interface DragBlank {
  id: string;
  answer: string;
  acceptedAnswers?: string[];
}

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
  skipped?: boolean;
  remainingSeconds?: number;
}

export interface ParseResult {
  questions: Question[];
  errors: string[];
}

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
}

export interface ResultData {
  questions: Question[];
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  percentage: number;
}

export interface HistoryEntry {
  id?: string;
  date: string;
  completedAt?: string;
  topic: string;
  score: number;
  total: number;
  percentage: number;
}

export interface QuizSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  quiz: QuizState;
}

export interface StoredData {
  lastQuizText?: string;
  preferences?: Partial<QuizSettings>;
  activeSession?: QuizSession | null;
  history?: HistoryEntry[];
  aiLinks?: Partial<AILinkSettings>;
}

export type ViewName = "home" | "input" | "quiz" | "results" | "prompt";
