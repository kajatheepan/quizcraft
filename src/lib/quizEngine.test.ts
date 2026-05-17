import { describe, expect, it } from "vitest";
import { buildPrompt, checkAnswer } from "@/lib/quizEngine";
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

describe("buildPrompt", () => {
  it("uses short plain-text explanations by default", () => {
    const prompt = buildPrompt("Data Link Layer", 5, new Set(["MCQ"]), "Medium", "");

    expect(prompt).toContain("Question style: Exam practice.");
    expect(prompt).toContain("Mix recall, application, comparison, and misconception questions");
    expect(prompt).toContain("Explanation detail: Short.");
    expect(prompt).toContain("Explanations must be short plain text");
  });

  it("can request full Markdown explanations", () => {
    const prompt = buildPrompt("Data Link Layer", 5, new Set(["MCQ"]), "Medium", "", "full");

    expect(prompt).toContain("Explanation detail: Full Markdown.");
    expect(prompt).toContain("Markdown tables");
    expect(prompt).toContain("Do not use raw HTML, SVG, or external images.");
  });

  it("can generate a format-only prompt for custom instructions", () => {
    const prompt = buildPrompt("Data Link Layer", 5, new Set(["MCQ"]), "Medium", "", "short", "format");

    expect(prompt).toContain("Use this QuizCraft JSON format");
    expect(prompt).toContain("You can write your own quiz instructions above this format");
    expect(prompt).toContain('"questions": [');
    expect(prompt).not.toContain("Question quality policy");
    expect(prompt).not.toContain("Source policy");
  });

  it("can request hard application questions", () => {
    const prompt = buildPrompt("Operating Systems", 5, new Set(["MCQ"]), "Hard", "", "short", "guided", "hard");

    expect(prompt).toContain("Question style: Hard application.");
    expect(prompt).toContain("Use scenarios, troubleshooting cases, edge cases");
    expect(prompt).toContain("multi-step reasoning");
  });

  it("can request past paper style questions", () => {
    const prompt = buildPrompt("Networking", 5, new Set(["MCQ"]), "Hard", "", "short", "guided", "past");

    expect(prompt).toContain("Question style: Past paper style.");
    expect(prompt).toContain("formal exam-style wording");
    expect(prompt).toContain("conceptual traps");
  });

  it("can require uploaded sources only", () => {
    const prompt = buildPrompt("Data Link Layer", 5, new Set(["MCQ"]), "Medium", "", "short", "guided", "exam", "only");

    expect(prompt).toContain("Source usage: Use uploaded sources only.");
    expect(prompt).toContain("Do not use outside knowledge or generic topic knowledge.");
    expect(prompt).toContain('"questions": []');
    expect(prompt).toContain("Upload notes, slides, PDFs, or source material");
  });
});
