// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────

import { STORAGE_KEY } from "@/lib/constants";
import type { HistoryEntry, QuizSettings, StoredData } from "@/types/quiz";

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
