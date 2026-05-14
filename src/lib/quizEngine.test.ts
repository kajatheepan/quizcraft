import { describe, expect, it } from "vitest";
import { checkAnswer } from "@/lib/quizEngine";
import type { Question } from "@/types/quiz";

const baseQuestion: Question = {
  id: 1,
  type: "MCQ",
  question: "Question?",
  options: { A: "One", B: "Two", C: "Three", D: "Four" },
  answer: "B",
  explanation: "Explanation.",
  userAnswer: null,
  isCorrect: null,
  status: "unseen",
};

describe("checkAnswer", () => {
  it("checks MCQ answers case-insensitively", () => {
    expect(checkAnswer(baseQuestion, "b")).toBe(true);
    expect(checkAnswer(baseQuestion, "A")).toBe(false);
  });

  it("checks TF answers case-insensitively", () => {
    expect(checkAnswer({ ...baseQuestion, type: "TF", options: {}, answer: "TRUE" }, "true")).toBe(true);
  });

  it("accepts typed fill acceptedAnswers", () => {
    const question: Question = {
      ...baseQuestion,
      type: "FILL",
      fillMode: "typed",
      options: {},
      answer: "48",
      acceptedAnswers: ["48", "forty eight", "forty-eight"],
    };

    expect(checkAnswer(question, "forty-eight")).toBe(true);
  });

  it("normalizes punctuation and case for typed fill answers", () => {
    const question: Question = {
      ...baseQuestion,
      type: "FILL",
      fillMode: "typed",
      options: {},
      answer: "Data Link Layer",
      acceptedAnswers: ["data-link layer"],
    };

    expect(checkAnswer(question, "DATA link layer")).toBe(true);
  });

  it("requires drag-drop answers to match the blank order", () => {
    const question: Question = {
      ...baseQuestion,
      type: "FILL",
      fillMode: "dragdrop",
      options: {},
      answer: ["heart", "artery"],
      blanks: [
        { id: "1", answer: "heart" },
        { id: "2", answer: "artery" },
      ],
      choices: ["heart", "artery", "vein"],
    };

    expect(checkAnswer(question, ["heart", "artery"])).toBe(true);
    expect(checkAnswer(question, ["artery", "heart"])).toBe(false);
  });
});
