import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  incr: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return redisMocks;
  }),
}));

async function loadStatsStore() {
  vi.resetModules();
  return import("@/lib/server/statsStore");
}

describe("Redis stats store", () => {
  beforeEach(() => {
    redisMocks.incr.mockReset();
    redisMocks.get.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
  });

  it("increments both counters", async () => {
    redisMocks.incr.mockResolvedValueOnce(12).mockResolvedValueOnce(4);
    const { incrementQuizzesStarted, incrementQuizzesShared } = await loadStatsStore();

    await expect(incrementQuizzesStarted()).resolves.toBe(12);
    await expect(incrementQuizzesShared()).resolves.toBe(4);
  });

  it("returns both counters as numbers", async () => {
    redisMocks.get.mockResolvedValueOnce("10482").mockResolvedValueOnce(3201);
    const { getQuizStats } = await loadStatsStore();

    await expect(getQuizStats()).resolves.toEqual({
      quizzesStarted: 10482,
      quizzesShared: 3201,
    });
  });

  it("reuses the cached stats on repeated reads", async () => {
    redisMocks.get.mockResolvedValueOnce(11).mockResolvedValueOnce(3);
    const { getQuizStats } = await loadStatsStore();

    await expect(getQuizStats()).resolves.toEqual({ quizzesStarted: 11, quizzesShared: 3 });
    await expect(getQuizStats()).resolves.toEqual({ quizzesStarted: 11, quizzesShared: 3 });
    expect(redisMocks.get).toHaveBeenCalledTimes(2);
  });
});