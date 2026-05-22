import { afterEach, describe, expect, it, vi } from "vitest";
import { compressQuiz, decompressQuiz, minifyQuiz, expandQuiz } from "./compression";
import type { Question } from "@/types/quiz";

const mockQuestions: Question[] = [
  {
    id: 1,
    type: "MCQ",
    question: "Which layer is responsible for routing?",
    options: { A: "Physical", B: "Network", C: "Data Link", D: "Application" },
    answer: "B",
    explanation: "Network layer handles routing.",
    userAnswer: null,
    isCorrect: null,
    status: "unseen"
  },
  {
    id: 2,
    type: "TF",
    question: "IP guarantees delivery.",
    options: {},
    answer: "FALSE",
    explanation: "IP is best-effort.",
    userAnswer: null,
    isCorrect: null,
    status: "unseen"
  },
  {
    id: 3,
    type: "FILL",
    fillMode: "typed",
    question: "___ address is 48-bits.",
    options: {},
    answer: "MAC",
    acceptedAnswers: ["MAC", "Media Access Control"],
    explanation: "MAC address has 48 bits.",
    userAnswer: null,
    isCorrect: null,
    status: "unseen"
  }
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Quiz Schema Minification", () => {
  it("minifies keys into single characters", () => {
    const minified = minifyQuiz(mockQuestions);
    expect(minified).toHaveLength(3);
    
    // Check first question minified format
    const q1 = minified[0];
    expect(q1).toHaveProperty("i", 1);
    expect(q1).toHaveProperty("t", "MCQ");
    expect(q1).toHaveProperty("x", "Which layer is responsible for routing?");
    expect(q1).toHaveProperty("o");
    expect(q1.o).toEqual({ A: "Physical", B: "Network", C: "Data Link", D: "Application" });
    expect(q1).toHaveProperty("a", "B");
    expect(q1).toHaveProperty("e", "Network layer handles routing.");
    
    // Original keys should NOT be present
    expect(q1).not.toHaveProperty("id");
    expect(q1).not.toHaveProperty("type");
    expect(q1).not.toHaveProperty("question");
    expect(q1).not.toHaveProperty("options");
    expect(q1).not.toHaveProperty("answer");
    expect(q1).not.toHaveProperty("explanation");
  });

  it("expands single-character keys back to the standard Question schema", () => {
    const minified = minifyQuiz(mockQuestions);
    const expanded = expandQuiz(minified);

    expect(expanded).toHaveLength(3);
    expect(expanded[0].id).toBe(1);
    expect(expanded[0].type).toBe("MCQ");
    expect(expanded[0].question).toBe("Which layer is responsible for routing?");
    expect(expanded[0].options).toEqual({ A: "Physical", B: "Network", C: "Data Link", D: "Application" });
    expect(expanded[0].answer).toBe("B");
    expect(expanded[0].explanation).toBe("Network layer handles routing.");
    expect(expanded[0].status).toBe("unseen");
    expect(expanded[0].userAnswer).toBeNull();
    expect(expanded[0].isCorrect).toBeNull();
  });
});

describe("Quiz Binary Compression Roundtrip", () => {
  it("compresses and decompresses a full quiz accurately", async () => {
    const compressed = await compressQuiz(mockQuestions);
    expect(typeof compressed).toBe("string");
    expect(compressed.length).toBeGreaterThan(0);
    // Base64URL-safe checks: should not contain +, / or =
    expect(compressed).not.toContain("+");
    expect(compressed).not.toContain("/");
    expect(compressed).not.toContain("=");

    const decompressed = await decompressQuiz(compressed);
    expect(decompressed).toHaveLength(3);
    expect(decompressed[0].id).toBe(1);
    expect(decompressed[0].type).toBe("MCQ");
    expect(decompressed[1].type).toBe("TF");
    expect(decompressed[2].type).toBe("FILL");
    expect(decompressed[2].acceptedAnswers).toEqual(["MAC", "Media Access Control"]);
    expect(decompressed[2].fillMode).toBe("typed");
  });

  it("throws error for corrupted or empty strings during decompression", async () => {
    await expect(decompressQuiz("")).rejects.toThrow();
    await expect(decompressQuiz("invalid-base64-string-here")).rejects.toThrow();
  });

  it("falls back to URL-safe JSON encoding when browser compression is unavailable", async () => {
    vi.stubGlobal("CompressionStream", undefined);

    const compressed = await compressQuiz(mockQuestions);
    expect(compressed.startsWith("j.")).toBe(true);

    vi.stubGlobal("DecompressionStream", undefined);
    const decompressed = await decompressQuiz(compressed);
    expect(decompressed).toHaveLength(3);
    expect(decompressed[0].question).toBe("Which layer is responsible for routing?");
  });
});
