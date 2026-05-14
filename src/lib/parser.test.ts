import { describe, expect, it } from "vitest";
import { parseQuiz } from "@/lib/parser";

const validJsonQuiz = JSON.stringify({
  questions: [
    {
      id: 1,
      type: "MCQ",
      question: "Which layer uses frames?",
      options: { A: "Network", B: "Data Link", C: "Transport", D: "Session" },
      answer: "B",
      explanation: "The Data Link Layer uses frames.",
    },
    {
      id: 2,
      type: "FILL",
      fillMode: "typed",
      question: "The MAC address is ___ bits.",
      answer: "48",
      acceptedAnswers: ["48", "forty eight"],
      explanation: "MAC addresses are 48 bits.",
    },
    {
      id: 3,
      type: "FILL",
      fillMode: "dragdrop",
      question: "The [[1]] algorithm reduces collisions.",
      blanks: [{ id: "1", answer: "backoff" }],
      choices: ["backoff", "frame", "packet"],
      explanation: "Backoff reduces repeated collisions.",
    },
    {
      id: 4,
      type: "TF",
      question: "CSMA/CD detects collisions.",
      answer: "TRUE",
      explanation: "Collision detection is part of CSMA/CD.",
    },
  ],
});

describe("parseQuiz", () => {
  it("parses the supported JSON question types", () => {
    const result = parseQuiz(validJsonQuiz);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(4);
    expect(result.questions.map((question) => question.type)).toEqual(["MCQ", "FILL", "FILL", "TF"]);
    expect(result.questions[2].fillMode).toBe("dragdrop");
  });

  it("returns JSON-focused errors for invalid JSON", () => {
    const result = parseQuiz('{ "questions": [ { "id": 1, } ] }');

    expect(result.questions).toEqual([]);
    expect(result.errors[0]).toContain("JSON is invalid");
    expect(result.errors[0]).toContain("Expected");
  });

  it("returns a clear error when JSON does not contain questions", () => {
    const result = parseQuiz('{ "items": [] }');

    expect(result.questions).toEqual([]);
    expect(result.errors[0]).toBe('Expected { "questions": [...] } or an array of question objects.');
  });

  it("returns a clear MCQ option error when option D is missing", () => {
    const result = parseQuiz(JSON.stringify({
      questions: [
        {
          id: 1,
          type: "MCQ",
          question: "Pick one.",
          options: { A: "A", B: "B", C: "C" },
          answer: "A",
          explanation: "A is correct.",
        },
      ],
    }));

    expect(result.questions).toEqual([]);
    expect(result.errors[0]).toBe("Q1: MCQ questions need options A, B, C, and D.");
  });

  it("still supports legacy Q1 format", () => {
    const result = parseQuiz(`
Q1. CSMA/CD detects collisions.
TYPE: TF
ANSWER: TRUE
EXPLANATION: Collision detection is part of CSMA/CD.
`);

    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].type).toBe("TF");
  });
});
