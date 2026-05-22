import { compressQuiz, minifyQuiz } from "@/lib/compression";
import { getCachedShareLink, saveCachedShareLink } from "@/lib/storage";
import type { CachedShareLink, Question } from "@/types/quiz";

export interface ShareLinkResult extends CachedShareLink {
  fingerprint: string;
  cacheHit: boolean;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function createQuizFingerprint(questions: Question[]): string {
  return hashString(JSON.stringify(minifyQuiz(questions)));
}

export async function getShareLinkForQuiz(questions: Question[]): Promise<ShareLinkResult> {
  if (!questions || questions.length === 0) {
    throw new Error("No questions found to share");
  }

  const fingerprint = createQuizFingerprint(questions);
  const cached = getCachedShareLink(fingerprint);
  if (cached) {
    return { ...cached, fingerprint, cacheHit: true };
  }

  const compressed = await compressQuiz(questions);
  const baseUrl = window.location.origin;
  const longUrl = `${baseUrl}/?q=${compressed}`;

  const response = await fetch("/api/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: longUrl })
  });

  if (!response.ok) {
    throw new Error("Failed to generate sharing link");
  }

  const data = await response.json();
  const url = typeof data.shortUrl === "string" && data.shortUrl ? data.shortUrl : longUrl;
  const link: CachedShareLink = {
    url,
    createdAt: new Date().toISOString(),
    source: url === longUrl ? "long" : "short",
  };

  saveCachedShareLink(fingerprint, link);
  return { ...link, fingerprint, cacheHit: false };
}
