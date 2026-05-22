import { beforeEach, describe, expect, it, vi } from "vitest";

const shareStoreMocks = vi.hoisted(() => ({
  getSharedQuiz: vi.fn(),
  isValidShareId: vi.fn((id: string) => /^[A-Za-z0-9_-]{16}$/.test(id)),
}));

vi.mock("@/lib/server/shareStore", () => ({
  getSharedQuiz: shareStoreMocks.getSharedQuiz,
  isValidShareId: shareStoreMocks.isValidShareId,
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("GET /api/share/[id]", () => {
  beforeEach(() => {
    shareStoreMocks.getSharedQuiz.mockReset();
    shareStoreMocks.isValidShareId.mockClear();
  });

  it("returns quiz data for a valid share id", async () => {
    shareStoreMocks.getSharedQuiz.mockResolvedValue([{ id: 1, question: "Question?" }]);
    const { GET } = await loadRoute();

    const response = await GET(
      new Request("http://localhost/api/share/abc1234567890_-x"),
      { params: { id: "abc1234567890_-x" } }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.questions).toHaveLength(1);
  });

  it("returns 404 when a share id is missing or expired", async () => {
    shareStoreMocks.getSharedQuiz.mockResolvedValue(null);
    const { GET } = await loadRoute();

    const response = await GET(
      new Request("http://localhost/api/share/abc1234567890_-x"),
      { params: { id: "abc1234567890_-x" } }
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid share ids", async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new Request("http://localhost/api/share/bad-id"),
      { params: { id: "bad-id" } }
    );

    expect(response.status).toBe(400);
    expect(shareStoreMocks.getSharedQuiz).not.toHaveBeenCalled();
  });
});
