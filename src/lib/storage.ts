// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
// Lightweight wrapper around `localStorage` used to persist sessions, history
// and small user preferences. Keep logic minimal and defensive for SSR.

import { STORAGE_KEY } from "@/lib/constants";
import type { AILinkSettings, HistoryEntry, QuizSession, QuizSettings, StoredData } from "@/types/quiz";

const DEFAULT_AI_LINK_SETTINGS: AILinkSettings = {
  chatgpt: { mode: "new", conversationRef: "" },
  claude: { mode: "new", conversationRef: "" },
};

/**
 * Load persisted store from `localStorage`.
 * Returns an empty object when running on the server or on parse error.
 */
function load(): StoredData {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredData;
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

/**
 * Return in-progress sessions sorted by most recently updated first.
 * Useful for showing a "Continue" card on the home screen.
 */
export function getInProgressSessions(): QuizSession[] {
  return getSessions()
    .filter((session) => session.status === "in-progress")
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

export { DEFAULT_AI_LINK_SETTINGS };
