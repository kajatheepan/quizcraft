import { beforeEach, describe, expect, it, vi } from "vitest";

const statsStoreMocks = vi.hoisted(() => ({
  getQuizStats: vi.fn(),
}));

vi.mock("@/lib/server/statsStore", () => ({
  getQuizStats: statsStoreMocks.getQuizStats,
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("GET /api/stats", () => {
  beforeEach(() => {
    statsStoreMocks.getQuizStats.mockReset();
  });

  it("returns the quiz counters", async () => {
    statsStoreMocks.getQuizStats.mockResolvedValue({ quizzesStarted: 10482, quizzesShared: 3201 });
    const { GET } = await loadRoute();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ quizzesStarted: 10482, quizzesShared: 3201 });
  });
});