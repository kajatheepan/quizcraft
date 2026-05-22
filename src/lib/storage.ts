// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
// Lightweight wrapper around `localStorage` used to persist sessions, history
// and small user preferences. Keep logic minimal and defensive for SSR.

import { STORAGE_KEY } from "@/lib/constants";
import type { AILinkSettings, CachedShareLink, HistoryEntry, QuizSession, QuizSettings, QuizState, ResultData, StoredData, ThemeMode } from "@/types/quiz";

const DEFAULT_AI_LINK_SETTINGS: AILinkSettings = {
  chatgpt: { mode: "new", conversationRef: "" },
  claude: { mode: "new", conversationRef: "" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizePreferences(value: unknown): Partial<QuizSettings> {
  if (!isRecord(value)) return {};
  const next: Partial<QuizSettings> = {};
  if (typeof value.shuffle === "boolean") next.shuffle = value.shuffle;
  if (typeof value.shuffleOptions === "boolean") next.shuffleOptions = value.shuffleOptions;
  if (value.explanationTiming === "after" || value.explanationTiming === "end") {
    next.explanationTiming = value.explanationTiming;
  }
  if (typeof value.timer === "boolean") next.timer = value.timer;
  if (typeof value.timerSeconds === "number" && Number.isFinite(value.timerSeconds)) {
    next.timerSeconds = Math.min(300, Math.max(5, Math.round(value.timerSeconds)));
  }
  return next;
}

function sanitizeQuizSettings(value: unknown): QuizSettings {
  const prefs = sanitizePreferences(value);
  return {
    shuffle: prefs.shuffle ?? true,
    shuffleOptions: prefs.shuffleOptions ?? true,
    explanationTiming: prefs.explanationTiming ?? "after",
    timer: prefs.timer ?? false,
    timerSeconds: prefs.timerSeconds ?? 30,
  };
}

function sanitizeQuizState(value: unknown): QuizState | null {
  if (!isRecord(value) || !Array.isArray(value.questions) || value.questions.length === 0) return null;
  const questions = value.questions as QuizState["questions"];
  const current = Math.min(Math.max(Math.round(safeNumber(value.current, 0)), 0), questions.length - 1);

  return {
    questions,
    original: Array.isArray(value.original) && value.original.length > 0
      ? value.original as QuizState["original"]
      : questions,
    current,
    correct: safeNumber(value.correct),
    wrong: safeNumber(value.wrong),
    skipped: safeNumber(value.skipped),
    startTime: typeof value.startTime === "number" && Number.isFinite(value.startTime) ? value.startTime : null,
    settings: sanitizeQuizSettings(value.settings),
    answered: typeof value.answered === "boolean" ? value.answered : false,
  };
}

function sanitizeResult(value: unknown): ResultData | undefined {
  if (!isRecord(value) || !Array.isArray(value.questions) || value.questions.length === 0) return undefined;
  const total = safeNumber(value.total, value.questions.length);
  if (total <= 0) return undefined;
  const correct = safeNumber(value.correct);
  const wrong = safeNumber(value.wrong);
  const skipped = safeNumber(value.skipped);
  const percentage = safeNumber(value.percentage, Math.round((correct / total) * 100));

  return {
    questions: value.questions as ResultData["questions"],
    correct,
    wrong,
    skipped,
    total,
    percentage,
  };
}

function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const history: HistoryEntry[] = [];

  value.filter(isRecord).forEach((item) => {
    const topic = safeString(item.topic, "Quiz");
    const total = safeNumber(item.total, 0);
    const score = safeNumber(item.score, 0);
    const percentage = safeNumber(item.percentage, total > 0 ? Math.round((score / total) * 100) : 0);

    if (total <= 0) return;

    history.push({
      id: typeof item.id === "string" ? item.id : undefined,
      sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
      date: safeString(item.date, new Date().toLocaleDateString()),
      completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
      topic,
      score,
      total,
      percentage,
      result: sanitizeResult(item.result),
    });
  });

  return history;
}

function sanitizeSessions(value: unknown): QuizSession[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item) => {
    const quiz = sanitizeQuizState(item.quiz);
    if (!quiz) return [];

    const status = item.status === "completed" ? "completed" : "in-progress";
    const now = new Date().toISOString();
    return [{
      id: safeString(item.id, String(Date.now())),
      title: safeString(item.title, "Saved quiz"),
      createdAt: safeString(item.createdAt, now),
      updatedAt: safeString(item.updatedAt, now),
      completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
      status,
      quiz,
    }];
  });
}

function sanitizeAILinks(value: unknown): Partial<AILinkSettings> {
  if (!isRecord(value)) return {};
  const readProvider = (provider: unknown) => {
    if (!isRecord(provider)) return undefined;
    return {
      mode: provider.mode === "continue" ? "continue" as const : "new" as const,
      conversationRef: safeString(provider.conversationRef),
    };
  };

  return {
    chatgpt: readProvider(value.chatgpt),
    claude: readProvider(value.claude),
  };
}

function sanitizeShareLinks(value: unknown): Record<string, CachedShareLink> {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, CachedShareLink>>((links, [fingerprint, item]) => {
    if (!isRecord(item)) return links;
    const url = safeString(item.url);
    const createdAt = safeString(item.createdAt);
    if (!url || !createdAt) return links;

    links[fingerprint] = {
      url,
      createdAt,
      source: item.source === "redis" || item.source === "short" ? item.source : "long",
    };
    return links;
  }, {});
}

function sanitizeStoredData(value: unknown): StoredData {
  if (!isRecord(value)) return {};

  const sessions = sanitizeSessions(value.sessions);
  const activeSession = isRecord(value.activeSession)
    ? sanitizeSessions([value.activeSession])[0] ?? null
    : null;

  const next: StoredData = {
    lastQuizText: safeString(value.lastQuizText),
    preferences: sanitizePreferences(value.preferences),
    tutorialSeen: value.tutorialSeen === true,
    sessions,
    activeSession,
    history: sanitizeHistory(value.history),
    aiLinks: sanitizeAILinks(value.aiLinks),
    shareLinks: sanitizeShareLinks(value.shareLinks),
    themeMode: value.themeMode === "light" || value.themeMode === "dark" || value.themeMode === "system"
      ? value.themeMode
      : undefined,
  };

  return next;
}

/**
 * Load persisted store from `localStorage`.
 * Returns an empty object when running on the server or on parse error.
 */
function load(): StoredData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sanitizeStoredData(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
    const sessions = raw.sessions ?? [];

    // Migrate legacy single active session to multi-session storage.
    if (raw.activeSession && sessions.length === 0) {
      const migrated: QuizSession = {
        ...raw.activeSession,
        status: raw.activeSession.status ?? "in-progress",
      };
      const next: StoredData = { ...raw, sessions: [migrated], activeSession: null };
      save(next);
      return next;
    }

    return raw;
  } catch {
    return {};
  }
}

/**
 * Save the given data object to `localStorage` under `STORAGE_KEY`.
 * Swallows errors to avoid interrupting the app when storage is unavailable.
 */
function save(data: StoredData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

/** Return recent completed quiz history entries (most-recent first). */
export function getHistory(): HistoryEntry[] {
  return load().history ?? [];
}

/** Clear completed quiz history only. */
export function clearHistory(): void {
  const data = load();
  save({ ...data, history: [] });
}

/** Upsert a history entry and cap history length to 10 items. */
export function saveHistory(entry: HistoryEntry): void {
  const data = load();
  const history = data.history ?? [];
  const nextHistory = entry.id
    ? history.filter((item) => item.id !== entry.id)
    : history;
  nextHistory.unshift(entry);
  if (nextHistory.length > 10) nextHistory.pop();
  save({ ...data, history: nextHistory });
}

/** Return all saved quiz sessions (includes in-progress and completed). */
export function getSessions(): QuizSession[] {
  return load().sessions ?? [];
}

function hasUnfinishedQuestion(session: QuizSession): boolean {
  return session.quiz.questions.some((question) =>
    question.status !== "answered" &&
    question.status !== "skipped" &&
    question.status !== "timedOut"
  );
}

/**
 * Return in-progress sessions sorted by most recently updated first.
 * Useful for showing a "Continue" card on the home screen.
 */
export function getInProgressSessions(): QuizSession[] {
  return getSessions()
    .filter((session) => session.status === "in-progress" && hasUnfinishedQuestion(session))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Find a session by id or return null if missing. */
export function getSessionById(sessionId: string): QuizSession | null {
  return getSessions().find((session) => session.id === sessionId) ?? null;
}

/** Persist a session (upsert). Newest sessions are stored at the front. */
export function saveSession(session: QuizSession): void {
  const data = load();
  const sessions = data.sessions ?? [];
  const next = [session, ...sessions.filter((item) => item.id !== session.id)];
  save({ ...data, sessions: next, activeSession: null });
}

/** Remove a saved session by id. */
export function clearSession(sessionId: string): void {
  const data = load();
  const sessions = (data.sessions ?? []).filter((session) => session.id !== sessionId);
  save({ ...data, sessions, activeSession: null });
}

/** Clear all saved sessions. Completed history is kept. */
export function clearAllSavedSessions(): void {
  const data = load();
  save({ ...data, sessions: [], activeSession: null });
}

/** Return the most-recent in-progress session or null when none exist. */
export function getActiveSession(): QuizSession | null {
  return getInProgressSessions()[0] ?? null;
}

/** Convenience: mark a session as active (in-progress) and persist it. */
export function saveActiveSession(session: QuizSession): void {
  saveSession({ ...session, status: "in-progress" });
}

/** Clear the active session; optionally target a specific session id. */
export function clearActiveSession(sessionId?: string): void {
  if (sessionId) {
    clearSession(sessionId);
    return;
  }

  const current = getActiveSession();
  if (!current) return;
  clearSession(current.id);
}

/** Return last pasted quiz text (used to re-populate input). */
export function getLastQuizText(): string {
  return load().lastQuizText ?? "";
}

/** Persist last pasted quiz text for convenience between sessions. */
export function saveLastQuizText(text: string): void {
  const data = load();
  save({ ...data, lastQuizText: text });
}

/** Clear the last pasted quiz draft. */
export function clearLastQuizText(): void {
  const data = load();
  save({ ...data, lastQuizText: "" });
}

/** Stored user preferences for quiz defaults (partial). */
export function getPreferences(): Partial<QuizSettings> {
  return load().preferences ?? {};
}

/** Merge and persist quiz preferences. */
export function savePreferences(prefs: Partial<QuizSettings>): void {
  const data = load();
  save({ ...data, preferences: { ...(data.preferences ?? {}), ...prefs } });
}

/** Whether the interactive tutorial has been shown to the user. */
export function getTutorialSeen(): boolean {
  return load().tutorialSeen === true;
}

/** Persist tutorial seen flag. */
export function saveTutorialSeen(seen: boolean): void {
  const data = load();
  save({ ...data, tutorialSeen: seen });
}

/** Retrieve saved AI provider link settings with sane defaults. */
export function getAILinkSettings(): AILinkSettings {
  const stored = load().aiLinks ?? {};
  return {
    chatgpt: {
      mode: stored.chatgpt?.mode === "continue" ? "continue" : "new",
      conversationRef: stored.chatgpt?.conversationRef ?? "",
    },
    claude: {
      mode: stored.claude?.mode === "continue" ? "continue" : "new",
      conversationRef: stored.claude?.conversationRef ?? "",
    },
  };
}

export function saveAILinkSettings(settings: Partial<AILinkSettings>): void {
  const data = load();
  const current = getAILinkSettings();
  const next: AILinkSettings = {
    chatgpt: { ...current.chatgpt, ...(settings.chatgpt ?? {}) },
    claude: { ...current.claude, ...(settings.claude ?? {}) },
  };
  save({ ...data, aiLinks: next });
}

export function getCachedShareLink(fingerprint: string): CachedShareLink | null {
  return load().shareLinks?.[fingerprint] ?? null;
}

export function saveCachedShareLink(fingerprint: string, link: CachedShareLink): void {
  const data = load();
  const shareLinks = data.shareLinks ?? {};
  const nextEntries = [
    [fingerprint, link] as const,
    ...Object.entries(shareLinks).filter(([key]) => key !== fingerprint),
  ].slice(0, 50);

  save({
    ...data,
    shareLinks: Object.fromEntries(nextEntries),
  });
}

export function getThemeMode(): ThemeMode {
  const mode = load().themeMode;
  return mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
}

export function saveThemeMode(themeMode: ThemeMode): void {
  const data = load();
  save({ ...data, themeMode });
}

export { DEFAULT_AI_LINK_SETTINGS };
