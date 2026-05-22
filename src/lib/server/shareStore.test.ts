import { beforeEach, describe, expect, it, vi } from "vitest";
import { minifyQuiz } from "@/lib/compression";
import type { Question } from "@/types/quiz";

const redisMocks = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return redisMocks;
  }),
}));

const questions: Question[] = [
  {
    id: 1,
    type: "MCQ",
    question: "Which layer routes packets?",
    options: { A: "Physical", B: "Network" },
    answer: "B",
    explanation: "Network layer handles routing.",
    userAnswer: null,
    isCorrect: null,
    status: "unseen",
  },
];

async function loadShareStore() {
  vi.resetModules();
  return import("@/lib/server/shareStore");
}

describe("Redis share store", () => {
  beforeEach(() => {
    redisMocks.set.mockReset();
    redisMocks.get.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("generates a non-predictable random share id format", async () => {
    const { generateShareId, isValidShareId } = await loadShareStore();

    const first = generateShareId();
    const second = generateShareId();

    expect(isValidShareId(first)).toBe(true);
    expect(first).toHaveLength(16);
    expect(first).not.toBe(second);
    expect(first).not.toContain("Which");
  });

  it("stores minified quiz data and returns URL from NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://quizcraft.example/";
    redisMocks.set.mockResolvedValue("OK");
    const { createSharedQuiz, SHARE_TTL_SECONDS } = await loadShareStore();

    const result = await createSharedQuiz(questions);

    expect(result.shareUrl).toBe(`https://quizcraft.example/share/${result.shareId}`);
    expect(redisMocks.set).toHaveBeenCalledWith(
      `share:${result.shareId}`,
      expect.objectContaining({
        v: 1,
        q: minifyQuiz(questions),
        createdAt: expect.any(String),
      }),
      { ex: SHARE_TTL_SECONDS, nx: true }
    );
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is missing", async () => {
    redisMocks.set.mockResolvedValue("OK");
    const { createSharedQuiz } = await loadShareStore();

    const result = await createSharedQuiz(questions);

    expect(result.shareUrl).toBe(`http://localhost:3000/share/${result.shareId}`);
  });

  it("returns expanded questions for a valid stored share id", async () => {
    const shareId = "abc1234567890_-x";
    redisMocks.get.mockResolvedValue({
      v: 1,
      q: minifyQuiz(questions),
      createdAt: "2026-05-22T00:00:00.000Z",
    });
    const { getSharedQuiz } = await loadShareStore();

    const result = await getSharedQuiz(shareId);

    expect(result?.[0].question).toBe("Which layer routes packets?");
    expect(redisMocks.get).toHaveBeenCalledWith(`share:${shareId}`);
  });

  it("returns null for missing or invalid share ids", async () => {
    redisMocks.get.mockResolvedValue(null);
    const { getSharedQuiz } = await loadShareStore();

    await expect(getSharedQuiz("bad id")).resolves.toBeNull();
    await expect(getSharedQuiz("abc1234567890_-x")).resolves.toBeNull();
  });
});
