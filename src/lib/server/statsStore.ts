import { Redis } from "@upstash/redis";

const STARTED_KEY = "stats:quizzes_started";
const SHARED_KEY = "stats:quizzes_shared";
const STATS_CACHE_TTL_MS = 5 * 60 * 1000;

let redis: Redis | null = null;
let statsCache: { value: QuizStats; expiresAt: number } | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Redis is not configured");
  }

  redis = new Redis({ url, token });
  return redis;
}

function asCount(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type QuizStats = {
  quizzesStarted: number;
  quizzesShared: number;
};

function getCachedStats(): QuizStats | null {
  if (!statsCache) return null;
  if (Date.now() >= statsCache.expiresAt) {
    statsCache = null;
    return null;
  }

  return statsCache.value;
}

function setCachedStats(value: QuizStats): void {
  statsCache = {
    value,
    expiresAt: Date.now() + STATS_CACHE_TTL_MS,
  };
}

function clearStatsCache(): void {
  statsCache = null;
}

export async function incrementQuizzesStarted(): Promise<number> {
  clearStatsCache();
  return getRedis().incr(STARTED_KEY);
}

export async function incrementQuizzesShared(): Promise<number> {
  clearStatsCache();
  return getRedis().incr(SHARED_KEY);
}

export async function getQuizStats(): Promise<QuizStats> {
  const cached = getCachedStats();
  if (cached) return cached;

  const [started, shared] = await Promise.all([
    getRedis().get(STARTED_KEY),
    getRedis().get(SHARED_KEY),
  ]);

  const stats = {
    quizzesStarted: asCount(started),
    quizzesShared: asCount(shared),
  };

  setCachedStats(stats);
  return stats;
}