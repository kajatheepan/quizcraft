import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";
import { expandQuiz, minifyQuiz } from "@/lib/compression";
import type { Question } from "@/types/quiz";

export const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{16}$/;
export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 30;

interface StoredSharePayload {
  v: 1;
  q: ReturnType<typeof minifyQuiz>;
  createdAt: string;
  title?: string;
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured");
  }

  redis = new Redis({ url, token });
  return redis;
}

export function getPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function generateShareId(): string {
  return randomBytes(12).toString("base64url");
}

export function isValidShareId(id: string): boolean {
  return SHARE_ID_REGEX.test(id);
}

export async function createSharedQuiz(questions: Question[], title?: string) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("No questions found to share");
  }

  const payload: StoredSharePayload = {
    v: 1,
    q: minifyQuiz(questions),
    createdAt: new Date().toISOString(),
    title: title?.trim() || undefined,
  };

  const client = getRedis();
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareId = generateShareId();
    const saved = await client.set(`share:${shareId}`, payload, {
      ex: SHARE_TTL_SECONDS,
      nx: true,
    });

    if (saved === "OK") {
      return {
        shareId,
        shareUrl: `${getPublicSiteUrl()}/share/${shareId}`,
        title: payload.title,
      };
    }
  }

  throw new Error("Could not create a unique share link");
}

export async function getSharedQuizData(shareId: string): Promise<{ questions: Question[]; title: string; count: number } | null> {
  if (!isValidShareId(shareId)) return null;

  const payload = await getRedis().get<StoredSharePayload>(`share:${shareId}`);
  if (!payload || payload.v !== 1 || !Array.isArray(payload.q)) {
    return null;
  }

  return {
    questions: expandQuiz(payload.q),
    title: payload.title ?? "",
    count: payload.q.length,
  };
}

export async function getSharedQuiz(shareId: string): Promise<Question[] | null> {
  const data = await getSharedQuizData(shareId);
  return data?.questions ?? null;
}

/** Returns lightweight metadata (title + question count) without fully decompressing.
 *  Used for OG metadata generation in the share page's generateMetadata().
 */
export async function getSharedQuizMeta(
  shareId: string
): Promise<{ title: string; count: number } | null> {
  const data = await getSharedQuizData(shareId);
  if (!data) return null;

  return {
    title: data.title,
    count: data.count,
  };
}
