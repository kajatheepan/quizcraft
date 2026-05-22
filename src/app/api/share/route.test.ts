import { beforeEach, describe, expect, it, vi } from "vitest";

const shareStoreMocks = vi.hoisted(() => ({
  createSharedQuiz: vi.fn(),
}));

vi.mock("@/lib/server/shareStore", () => ({
  createSharedQuiz: shareStoreMocks.createSharedQuiz,
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("POST /api/share", () => {
  beforeEach(() => {
    shareStoreMocks.createSharedQuiz.mockReset();
  });

  it("rejects empty question payloads", async () => {
    const { POST } = await loadRoute();

    const response = await POST(new Request("http://localhost/api/share", {
      method: "POST",
      body: JSON.stringify({ questions: [] }),
    }));

    expect(response.status).toBe(400);
    expect(shareStoreMocks.createSharedQuiz).not.toHaveBeenCalled();
  });

  it("creates a share link for valid question payloads", async () => {
    shareStoreMocks.createSharedQuiz.mockResolvedValue({
      shareId: "abc1234567890_-x",
      shareUrl: "https://quizcraft.example/share/abc1234567890_-x",
    });
    const { POST } = await loadRoute();

    const response = await POST(new Request("http://localhost/api/share", {
      method: "POST",
      body: JSON.stringify({ questions: [{ id: 1, question: "Question?" }] }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shareUrl).toBe("https://quizcraft.example/share/abc1234567890_-x");
    expect(shareStoreMocks.createSharedQuiz).toHaveBeenCalledTimes(1);
  });
});
