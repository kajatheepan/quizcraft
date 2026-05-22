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
    const result = parseQuiz('{ "questions": [invalid] }');

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
    expect(result.title).toBeUndefined();
  });

  it("extracts title from JSON title field", () => {
    const result = parseQuiz(JSON.stringify({
      title: "My JSON Quiz Title",
      questions: [
        {
          id: 1,
          type: "TF",
          question: "Question?",
          answer: "TRUE",
          explanation: "Exp",
        }
      ]
    }));
    expect(result.errors).toEqual([]);
    expect(result.title).toBe("My JSON Quiz Title");
  });

  it("accepts a nested quiz model with a title field", () => {
    const result = parseQuiz(JSON.stringify({
      model: {
        title: "Nested Quiz Model Title",
        questions: [
          {
            id: 1,
            type: "TF",
            question: "Question?",
            answer: "TRUE",
            explanation: "Exp",
          },
        ],
      },
    }));

    expect(result.errors).toEqual([]);
    expect(result.title).toBe("Nested Quiz Model Title");
    expect(result.questions).toHaveLength(1);
  });

  it("extracts title from raw text markdown header or title label", () => {
    // Markdown header format
    const resultHeader = parseQuiz(`
# My Markdown Header Quiz Title
{
  "questions": [
    {
      "id": 1,
      "type": "TF",
      "question": "Question?",
      "answer": "TRUE",
      "explanation": "Exp"
    }
  ]
}
    `);
    expect(resultHeader.title).toBe("My Markdown Header Quiz Title");

    // Title label format
    const resultLabel = parseQuiz(`
Title: My Title Label Quiz
{
  "questions": [
    {
      "id": 1,
      "type": "TF",
      "question": "Question?",
      "answer": "TRUE",
      "explanation": "Exp"
    }
  ]
}
    `);
    expect(resultLabel.title).toBe("My Title Label Quiz");
  });

  it("extracts title in legacy format using headers", () => {
    const result = parseQuiz(`
Title: Legacy Topic Header
Q1. CSMA/CD detects collisions.
TYPE: TF
ANSWER: TRUE
EXPLANATION: Collision detection is part of CSMA/CD.
    `);
    expect(result.title).toBe("Legacy Topic Header");
  });

  it("repairs and parses JSON with literal newlines, trailing commas, and unescaped quotes", () => {
    // A string with unescaped double quotes, trailing commas, and literal newlines.
    const malformedJson = `{
      "title": "Malformed but "Healed" Quiz",
      "questions": [
        {
          "id": 1,
          "type": "TF",
          "question": "Is this a literal
newline?",
          "answer": "TRUE",
          "explanation": "This has a trailing comma,",
        },
      ]
    }`;
    const result = parseQuiz(malformedJson);
    expect(result.errors).toEqual([]);
    expect(result.title).toBe('Malformed but "Healed" Quiz');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toContain("Is this a literal\nnewline?");
  });

  it("extracts JSON correctly even with preceding and trailing text containing curly braces", () => {
    const chatText = `
    Here is the response. Let's list some extra context {like this}.
    
    \`\`\`json
    {
      "title": "Fenced Title",
      "questions": [
        {
          "id": 1,
          "type": "TF",
          "question": "Q?",
          "answer": "TRUE",
          "explanation": "Exp"
        }
      ]
    }
    \`\`\`
    
    Hope you enjoy it! {another brace}
    `;
    const result = parseQuiz(chatText);
    expect(result.errors).toEqual([]);
    expect(result.title).toBe("Fenced Title");
    expect(result.questions).toHaveLength(1);
  });

  it("auto-heals a truncated JSON payload gracefully", () => {
    const truncated = `{
      "title": "Truncated",
      "questions": [
        {
          "id": 1,
          "type": "TF",
          "question": "Q?",
          "answer": "TRUE",
          "explanation": "Exp`;
    const result = parseQuiz(truncated);
    // Since it's truncated, it should heal it to close the string and brackets
    // check that it parses without syntax errors
    expect(result.title).toBe("Truncated");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].explanation).toBe("Exp");
  });
});
