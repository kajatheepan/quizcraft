import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { createQuizFingerprint, getShareLinkForQuiz } from "@/lib/shareLinks";
import type { Question } from "@/types/quiz";

const questions: Question[] = [
  {
    id: 1,
    type: "MCQ",
    question: "Which layer is responsible for routing?",
    options: { A: "Physical", B: "Network", C: "Data Link", D: "Application" },
    answer: "B",
    explanation: "Network layer handles routing.",
    userAnswer: null,
    isCorrect: null,
    status: "unseen",
  },
];

function mockShare(url = "https://quizcraft.test/share/abc1234567890_-x") {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ shareId: "abc1234567890_-x", shareUrl: url }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("quiz share link cache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("generates and stores a share link on first use", async () => {
    const fetchMock = mockShare();

    const result = await getShareLinkForQuiz(questions);

    expect(result.url).toBe("https://quizcraft.test/share/abc1234567890_-x");
    expect(result.cacheHit).toBe(false);
    expect(result.source).toBe("redis");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/share", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ questions }),
    }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.shareLinks[result.fingerprint].url).toBe("https://quizcraft.test/share/abc1234567890_-x");
  });

  it("reuses a cached link without calling the API again", async () => {
    const fetchMock = mockShare("https://quizcraft.test/share/cached1234567890");

    await getShareLinkForQuiz(questions);
    const second = await getShareLinkForQuiz(questions);

    expect(second.url).toBe("https://quizcraft.test/share/cached1234567890");
    expect(second.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores old non-Redis cached links and creates a Redis share link", async () => {
    const fingerprint = createQuizFingerprint(questions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      shareLinks: {
        [fingerprint]: {
          url: "https://old-shortener.example/abc",
          createdAt: "2026-05-22T00:00:00.000Z",
          source: "short",
        },
      },
    }));
    const fetchMock = mockShare();

    const result = await getShareLinkForQuiz(questions);

    expect(result.source).toBe("redis");
    expect(result.url).toBe("https://quizcraft.test/share/abc1234567890_-x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the same fingerprint for the same quiz with different runtime answer state", () => {
    const answeredQuestions = questions.map((question) => ({
      ...question,
      userAnswer: "B",
      isCorrect: true,
      status: "answered" as const,
    }));

    expect(createQuizFingerprint(answeredQuestions)).toBe(createQuizFingerprint(questions));
  });

  it("uses a different fingerprint when quiz content changes", () => {
    const changedQuestions = questions.map((question) => ({
      ...question,
      question: "Which layer handles frames?",
    }));

    expect(createQuizFingerprint(changedQuestions)).not.toBe(createQuizFingerprint(questions));
  });

  it("does not cache when the share request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShareLinkForQuiz(questions)).rejects.toThrow("network failed");
    await expect(getShareLinkForQuiz(questions)).rejects.toThrow("network failed");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.shareLinks).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
