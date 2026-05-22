import { Redis } from "@upstash/redis";

const STARTED_KEY = "stats:quizzes_started";
const SHARED_KEY = "stats:quizzes_shared";

let redis: Redis | null = null;

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

export async function incrementQuizzesStarted(): Promise<number> {
  return getRedis().incr(STARTED_KEY);
}

export async function incrementQuizzesShared(): Promise<number> {
  return getRedis().incr(SHARED_KEY);
}

export async function getQuizStats(): Promise<QuizStats> {
  const [started, shared] = await Promise.all([
    getRedis().get(STARTED_KEY),
    getRedis().get(SHARED_KEY),
  ]);

  return {
    quizzesStarted: asCount(started),
    quizzesShared: asCount(shared),
  };
}