import { minifyQuiz } from "@/lib/compression";
import { getCachedShareLink, saveCachedShareLink } from "@/lib/storage";
import type { CachedShareLink, Question } from "@/types/quiz";

const CACHED_SHARE_COPY_DELAY_MS = 180;

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

export async function getShareLinkForQuiz(questions: Question[], title?: string): Promise<ShareLinkResult> {
  if (!questions || questions.length === 0) {
    throw new Error("No questions found to share");
  }

  const fingerprint = createQuizFingerprint(questions);
  const cached = getCachedShareLink(fingerprint);
  if (cached?.source === "redis") {
    return { ...cached, fingerprint, cacheHit: true };
  }

  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions, title: title ?? null })
  });

  if (!response.ok) {
    throw new Error("Failed to generate sharing link");
  }

  const data = await response.json();
  if (typeof data.shareUrl !== "string" || !data.shareUrl) {
    throw new Error("Share API returned an invalid link");
  }

  const link: CachedShareLink = {
    url: data.shareUrl,
    createdAt: new Date().toISOString(),
    source: "redis",
  };

  saveCachedShareLink(fingerprint, link);
  return { ...link, fingerprint, cacheHit: false };
}

export async function waitForCachedShareLinkAnimation(cacheHit: boolean): Promise<void> {
  if (!cacheHit) return;

  await new Promise((resolve) => {
    setTimeout(resolve, CACHED_SHARE_COPY_DELAY_MS);
  });
}
