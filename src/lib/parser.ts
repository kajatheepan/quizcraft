// ── PARSER ────────────────────────────────────────────────────────────────────

import type { DragBlank, FillMode, ParseResult, Question, QuestionType } from "@/types/quiz";

type QuizJsonQuestion = {
  id?: number | string;
  type?: string;
  fillMode?: string;
  method?: string;
  interaction?: string;
  question?: string;
  prompt?: string;
  options?: Record<string, string>;
  answer?: string | string[];
  acceptedAnswers?: string[];
  blanks?: Array<{
    id?: number | string;
    answer?: string;
    acceptedAnswers?: string[];
  }>;
  choices?: string[];
  explanation?: string;
};

function normalizeType(raw: string): QuestionType | null {
  const t = raw.trim().toUpperCase();
  if (t === "MCQ" || t === "MULTIPLE CHOICE") return "MCQ";
  if (t === "FILL" || t === "FILL IN THE BLANK" || t === "FIB") return "FILL";
  if (t === "TF" || t === "TRUE/FALSE" || t === "TRUEFALSE") return "TF";
  return null;
}

function normalizeFillMode(raw: string | undefined): FillMode {
  const value = raw?.trim().toLowerCase();
  if (value === "dragdrop" || value === "drag-drop" || value === "drag and drop") return "dragdrop";
  return "typed";
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

function normalizeAnswers(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const answers = Array.isArray(value) ? value : [value];
  return answers.map((answer) => answer.trim()).filter((answer) => answer.length > 0);
}

function normalizeBlanks(blanks: QuizJsonQuestion["blanks"]): DragBlank[] {
  return (blanks ?? [])
    .map((blank, index) => ({
      id: String(blank.id ?? index + 1),
      answer: String(blank.answer ?? "").trim(),
      acceptedAnswers: normalizeAnswers(blank.acceptedAnswers),
    }))
    .filter((blank) => blank.answer.length > 0 || blank.acceptedAnswers?.length);
}

function parseJsonQuiz(rawText: string): ParseResult | null {
  const cleanedText = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    return null;
  }

  const payload = parsed as { questions?: QuizJsonQuestion[] } | QuizJsonQuestion[];
  const sourceQuestions = Array.isArray(payload) ? payload : payload.questions;
  if (!Array.isArray(sourceQuestions)) {
    return { questions: [], errors: ["JSON quiz must contain a questions array."] };
  }

  const errors: string[] = [];
  const questions: Question[] = [];

  sourceQuestions.forEach((item, index) => {
    const qNum = Number(item.id ?? index + 1);
    const questionType = item.type ? normalizeType(item.type) : null;
    const fillMode = normalizeFillMode(item.fillMode ?? item.method ?? item.interaction);
    const questionText = String(item.question ?? item.prompt ?? "").trim();
    const explanation = String(item.explanation ?? "").trim();
    const options = (item.options && typeof item.options === "object") ? item.options : {};
    const answerValue = item.answer;

    if (!Number.isFinite(qNum)) {
      errors.push(`Question ${index + 1}: Invalid id.`);
      return;
    }

    if (!questionType) {
      errors.push(`Q${qNum}: Missing or invalid type.`);
      return;
    }

    if (!questionText) {
      errors.push(`Q${qNum}: Missing question text.`);
      return;
    }

    if (!explanation) {
      errors.push(`Q${qNum}: Missing explanation.`);
      return;
    }

    if (questionType === "MCQ") {
      const normalizedOptions = Object.fromEntries(
        Object.entries(options)
          .map(([key, value]) => [key.toUpperCase(), String(value).trim()])
          .filter(([, value]) => value.length > 0)
      );
      const optionKeys = Object.keys(normalizedOptions);
      const normalizedAnswer = String(answerValue ?? "").trim().toUpperCase();
      if (optionKeys.length !== 4 || !["A", "B", "C", "D"].every((key) => normalizedOptions[key])) {
        errors.push(`Q${qNum}: MCQ requires exactly A, B, C, and D options.`);
        return;
      }
      if (!normalizedOptions[normalizedAnswer]) {
        errors.push(`Q${qNum}: ANSWER "${normalizedAnswer}" does not match any option.`);
        return;
      }

      questions.push({
        id: qNum,
        type: "MCQ",
        question: questionText,
        options: normalizedOptions,
        answer: normalizedAnswer,
        explanation,
        userAnswer: null,
        isCorrect: null,
      });
      return;
    }

    if (questionType === "TF") {
      const normalizedAnswer = String(answerValue ?? "").trim().toUpperCase();
      if (normalizedAnswer !== "TRUE" && normalizedAnswer !== "FALSE") {
        errors.push(`Q${qNum}: TF answer must be TRUE or FALSE.`);
        return;
      }

      questions.push({
        id: qNum,
        type: "TF",
        question: questionText,
        options: {},
        answer: normalizedAnswer,
        explanation,
        userAnswer: null,
        isCorrect: null,
      });
      return;
    }

    if (questionType === "FILL") {
      const blanks = normalizeBlanks(item.blanks);
      const acceptedAnswers = normalizeAnswers(item.acceptedAnswers);

      if (fillMode === "dragdrop") {
        const choices = (item.choices ?? []).map((choice) => String(choice).trim()).filter((choice) => choice.length > 0);
        const resolvedBlanks = blanks.length > 0
          ? blanks
          : normalizeAnswers(answerValue).map((answer, blankIndex) => ({
              id: String(blankIndex + 1),
              answer,
              acceptedAnswers: [answer],
            }));

        if (resolvedBlanks.length === 0) {
          errors.push(`Q${qNum}: Drag-and-drop fill questions need at least one blank.`);
          return;
        }

        const finalChoices = choices.length > 0 ? choices : resolvedBlanks.flatMap((blank) => [blank.answer, ...(blank.acceptedAnswers ?? [])]);

        questions.push({
          id: qNum,
          type: "FILL",
          fillMode: "dragdrop",
          question: questionText,
          options: {},
          answer: resolvedBlanks.map((blank) => blank.answer),
          blanks: resolvedBlanks,
          choices: finalChoices,
          explanation,
          userAnswer: null,
          isCorrect: null,
        });
        return;
      }

      const canonicalAnswer = String(answerValue ?? "").trim();
      if (!canonicalAnswer && acceptedAnswers.length === 0) {
        errors.push(`Q${qNum}: Fill question needs an answer.`);
        return;
      }

      questions.push({
        id: qNum,
        type: "FILL",
        fillMode: "typed",
        question: questionText,
        options: {},
        answer: canonicalAnswer || acceptedAnswers[0],
        acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : [canonicalAnswer],
        explanation,
        userAnswer: null,
        isCorrect: null,
      });
      return;
    }

    errors.push(`Q${qNum}: Unsupported question type.`);
  });

  return { questions, errors };
}

function parseLegacyQuiz(rawText: string): ParseResult {
  const errors: string[] = [];
  const questions: Question[] = [];

  let text = rawText.trim();
  text = text.replace(/===QUIZCRAFT FORMAT===/gi, "").replace(/===END===/gi, "").trim();

  const blocks = text
    .split(/(?=Q\d+\.)/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  if (blocks.length === 0) {
    return {
      questions: [],
      errors: ["No questions found. Make sure questions start with Q1., Q2., etc."],
    };
  }

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) continue;

    const qMatch = lines[0].match(/^Q(\d+)\.\s*(.+)/);
    if (!qMatch) {
      errors.push(`Block: Could not parse question number.`);
      continue;
    }

    const qNum = parseInt(qMatch[1], 10);
    const questionText = qMatch[2].trim();

    let type: QuestionType | null = null;
    const options: Record<string, string> = {};
    let answer: string | null = null;
    let explanation = "";

    for (const line of lines.slice(1)) {
      const typeMatch = line.match(/^TYPE:\s*(.+)/i);
      if (typeMatch) { type = normalizeType(typeMatch[1]); continue; }

      const optMatch = line.match(/^([A-D])\)\s*(.+)/);
      if (optMatch) { options[optMatch[1]] = optMatch[2].trim(); continue; }

      const ansMatch = line.match(/^ANSWER:\s*(.+)/i);
      if (ansMatch) { answer = ansMatch[1].trim(); continue; }

      const expMatch = line.match(/^EXPLANATION:\s*([\s\S]+)/i);
      if (expMatch) { explanation = expMatch[1].trim(); continue; }
    }

    if (!type) { errors.push(`Q${qNum}: Missing TYPE field.`); continue; }
    if (!answer) { errors.push(`Q${qNum}: Missing ANSWER field.`); continue; }

    if (type === "MCQ") {
      if (Object.keys(options).length !== 4) {
        errors.push(`Q${qNum}: MCQ requires exactly 4 answer options (A, B, C, D).`);
        continue;
      }
      answer = answer.toUpperCase();
      if (!options[answer]) {
        errors.push(`Q${qNum}: ANSWER "${answer}" does not match any option.`);
        continue;
      }
    }

    if (type === "TF") {
      const norm = answer.toUpperCase();
      if (norm !== "TRUE" && norm !== "FALSE") {
        errors.push(`Q${qNum}: TF answer must be TRUE or FALSE.`);
        continue;
      }
      answer = norm;
    }

    questions.push({
      id: qNum,
      type,
      question: questionText,
      options,
      answer,
      explanation,
      userAnswer: null,
      isCorrect: null,
    });
  }

  return { questions, errors };
}

export function parseQuiz(rawText: string): ParseResult {
  if (!rawText?.trim()) {
    return { questions: [], errors: ["Input is empty."] };
  }

  const text = rawText.trim().replace(/===QUIZCRAFT FORMAT===/gi, "").replace(/===END===/gi, "").trim();
  const jsonResult = parseJsonQuiz(text);
  if (jsonResult) return jsonResult;
  return parseLegacyQuiz(text);
}
