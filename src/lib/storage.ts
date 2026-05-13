// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────

import { STORAGE_KEY } from "@/lib/constants";
import type { AILinkSettings, HistoryEntry, QuizSession, QuizSettings, StoredData } from "@/types/quiz";

const DEFAULT_AI_LINK_SETTINGS: AILinkSettings = {
  chatgpt: { mode: "new", conversationRef: "" },
  claude: { mode: "new", conversationRef: "" },
};

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

function save(data: StoredData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getHistory(): HistoryEntry[] {
  return load().history ?? [];
}

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

export function getSessions(): QuizSession[] {
  return load().sessions ?? [];
}

export function getInProgressSessions(): QuizSession[] {
  return getSessions()
    .filter((session) => session.status === "in-progress")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSessionById(sessionId: string): QuizSession | null {
  return getSessions().find((session) => session.id === sessionId) ?? null;
}

export function saveSession(session: QuizSession): void {
  const data = load();
  const sessions = data.sessions ?? [];
  const next = [session, ...sessions.filter((item) => item.id !== session.id)];
  save({ ...data, sessions: next, activeSession: null });
}

export function clearSession(sessionId: string): void {
  const data = load();
  const sessions = (data.sessions ?? []).filter((session) => session.id !== sessionId);
  save({ ...data, sessions, activeSession: null });
}

export function getActiveSession(): QuizSession | null {
  return getInProgressSessions()[0] ?? null;
}

export function saveActiveSession(session: QuizSession): void {
  saveSession({ ...session, status: "in-progress" });
}

export function clearActiveSession(sessionId?: string): void {
  if (sessionId) {
    clearSession(sessionId);
    return;
  }

  const current = getActiveSession();
  if (!current) return;
  clearSession(current.id);
}

export function getLastQuizText(): string {
  return load().lastQuizText ?? "";
}

export function saveLastQuizText(text: string): void {
  const data = load();
  save({ ...data, lastQuizText: text });
}

export function getPreferences(): Partial<QuizSettings> {
  return load().preferences ?? {};
}

export function savePreferences(prefs: Partial<QuizSettings>): void {
  const data = load();
  save({ ...data, preferences: { ...(data.preferences ?? {}), ...prefs } });
}

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
