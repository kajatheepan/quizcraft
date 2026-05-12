// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────

import { STORAGE_KEY } from "@/lib/constants";
import type { AILinkSettings, HistoryEntry, QuizSettings, StoredData } from "@/types/quiz";

const DEFAULT_AI_LINK_SETTINGS: AILinkSettings = {
  chatgpt: { mode: "new", conversationRef: "" },
  claude: { mode: "new", conversationRef: "" },
};

function load(): StoredData {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredData;
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
  history.unshift(entry);
  if (history.length > 10) history.pop();
  save({ ...data, history });
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
