// ── QUIZ ENGINE ───────────────────────────────────────────────────────────────

import type { Question, QuizSettings, ResultData } from "@/types/quiz";

export function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleOptions(q: Question): Question {
  if (q.type !== "MCQ") return q;
  const letters = Object.keys(q.options);
  const shuffled = fisherYates(letters);
  const newOptions: Record<string, string> = {};
  const letterMap = ["A", "B", "C", "D"];
  shuffled.forEach((origLetter, i) => {
    newOptions[letterMap[i]] = q.options[origLetter];
  });
  const answerKey = typeof q.answer === "string" ? q.answer : q.answer[0] ?? "";
  const origAnswerText = q.options[answerKey];
  const newAnswerLetter = Object.keys(newOptions).find(
    (k) => newOptions[k] === origAnswerText
  ) ?? answerKey;
  return { ...q, options: newOptions, answer: newAnswerLetter };
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAnswerList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const answers = Array.isArray(value) ? value : [value];
  return answers.map((answer) => answer.trim()).filter((answer) => answer.length > 0);
}

function arraysMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => normalizeText(item) === normalizeText(right[index]));
}

export function prepareQuestions(questions: Question[], settings: QuizSettings): Question[] {
  let qs: Question[] = questions.map((q) => ({ ...q, userAnswer: null, isCorrect: null, skipped: false }));
  if (settings.shuffle) qs = fisherYates(qs);
  if (settings.shuffleOptions) qs = qs.map(shuffleOptions);
  return qs;
}

export function checkAnswer(q: Question, response: string | string[]): boolean {
  if (q.type === "MCQ" || q.type === "TF") {
    const expected = typeof q.answer === "string" ? q.answer : q.answer[0] ?? "";
    const actual = Array.isArray(response) ? response.join(" ") : response;
    return actual.trim().toUpperCase() === expected.trim().toUpperCase();
  }

  if (q.fillMode === "dragdrop") {
    const expected = normalizeAnswerList(q.answer);
    const actual = normalizeAnswerList(response);
    return arraysMatch(actual, expected);
  }

  const expectedAnswers = q.acceptedAnswers?.length ? q.acceptedAnswers : normalizeAnswerList(q.answer);
  const actualAnswer = normalizeText(Array.isArray(response) ? response.join(" ") : response);
  return expectedAnswers.some((answer) => normalizeText(answer) === actualAnswer);
}

export function buildResultData(
  questions: Question[],
  correct: number,
  wrong: number,
  skipped: number
): ResultData {
  return {
    questions,
    correct,
    wrong,
    skipped,
    total: questions.length,
    percentage: Math.round((correct / questions.length) * 100),
  };
}

export function getScoreMessage(percentage: number): string {
  if (percentage >= 90) return "Excellent work.";
  if (percentage >= 70) return "Good job — nearly there.";
  if (percentage >= 50) return "Keep reviewing.";
  return "More practice needed.";
}

export function buildPrompt(
  subject: string,
  count: number,
  types: Set<string>,
  difficulty: string,
  focus: string
): string {
  const subjectStr = subject.trim() || "[YOUR TOPIC]";
  const typeList = Array.from(types).join(", ") || "MCQ";
  const focusLine = focus.trim() ? `\nFocus areas: ${focus.trim()}` : "";

  return `You are a quiz generator. Return ONLY valid JSON. Do not wrap the response in markdown.

Generate ${count} quiz questions about "${subjectStr}".
Question types allowed: ${typeList}.
Difficulty: ${difficulty}.${focusLine}

Use this exact JSON shape:
{
  "questions": [
    {
      "id": 1,
      "type": "MCQ",
      "question": "Question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "B",
      "explanation": "Short explanation"
    },
    {
      "id": 2,
      "type": "FILL",
      "fillMode": "typed",
      "question": "The MAC address is ___ bits long.",
      "answer": "48",
      "acceptedAnswers": ["48", "forty eight", "forty-eight"],
      "explanation": "Short explanation"
    },
    {
      "id": 3,
      "type": "FILL",
      "fillMode": "dragdrop",
      "question": "The [[1]] pumps blood and the [[2]] carries it away from the heart.",
      "blanks": [
        { "id": "1", "answer": "heart", "acceptedAnswers": ["heart"] },
        { "id": "2", "answer": "artery", "acceptedAnswers": ["artery", "arteries"] }
      ],
      "choices": ["heart", "artery", "vein"],
      "explanation": "Short explanation"
    },
    {
      "id": 4,
      "type": "TF",
      "question": "True or false question",
      "answer": "TRUE",
      "explanation": "Short explanation"
    }
  ]
}

Rules:
- Return JSON only, with no trailing commentary.
- MCQ questions must have exactly four options: A, B, C, and D.
- FILL questions can use fillMode "typed" for direct answers or "dragdrop" for paragraph blanks.
- For typed fill answers, include acceptedAnswers when multiple phrasings should count as correct.
- For dragdrop fill questions, use [[1]], [[2]], etc. inside the question text and provide matching blanks and choices.
- TF answers must be exactly TRUE or FALSE.
- Number questions sequentially from 1 to ${count}.`;
}
