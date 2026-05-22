// ── PARSER ────────────────────────────────────────────────────────────────────
// Parsing utilities to accept both structured JSON quiz payloads and a
// legacy plain-text format. Functions here are defensive and return detailed
// error messages suitable for showing to the user.

import type { DragBlank, FillMode, ParseResult, Question, QuestionType } from "@/types/quiz";
import { jsonrepair } from "jsonrepair";

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

type QuizJsonPayload = {
  title?: string;
  questions?: QuizJsonQuestion[];
  quiz?: QuizJsonPayload;
  model?: QuizJsonPayload;
  data?: QuizJsonPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Convert a loose type string into a canonical QuestionType or null when unknown.
function normalizeType(raw: string): QuestionType | null {
  const t = raw.trim().toUpperCase();
  if (t === "MCQ" || t === "MULTIPLE CHOICE") return "MCQ";
  if (t === "FILL" || t === "FILL IN THE BLANK" || t === "FIB") return "FILL";
  if (t === "TF" || t === "TRUE/FALSE" || t === "TRUEFALSE") return "TF";
  return null;
}

// Normalize various synonyms for drag/drop fill mode.
function normalizeFillMode(raw: string | undefined): FillMode {
  const value = raw?.trim().toLowerCase();
  if (value === "dragdrop" || value === "drag-drop" || value === "drag and drop") return "dragdrop";
  return "typed";
}

// Normalizes free text for comparison and parsing.
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

// Turn an answer value into an array of trimmed answers.
function normalizeAnswers(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const answers = Array.isArray(value) ? value : [value];
  return answers.map((answer) => answer.trim()).filter((answer) => answer.length > 0);
}

// Convert a raw blanks array into well-formed `DragBlank` entries.
function normalizeBlanks(blanks: QuizJsonQuestion["blanks"]): DragBlank[] {
  return (blanks ?? [])
    .map((blank, index) => ({
      id: String(blank.id ?? index + 1),
      answer: String(blank.answer ?? "").trim(),
      acceptedAnswers: normalizeAnswers(blank.acceptedAnswers),
    }))
    .filter((blank) => blank.answer.length > 0 || blank.acceptedAnswers?.length);
}

function stripJsonCodeFence(rawText: string): string {
  return rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonString(rawText: string): string {
  const fenceMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
  const text = fenceMatch ? fenceMatch[1].trim() : stripJsonCodeFence(rawText);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return text.substring(arrayStart, arrayEnd + 1);
  }
  return text;
}

function looksLikeLegacyQuiz(rawText: string): boolean {
  return /(^|\n)\s*Q\d+\./i.test(rawText);
}

function looksLikeJson(rawText: string): boolean {
  const cleaned = stripJsonCodeFence(rawText);
  return cleaned.includes("{") || cleaned.includes("[");
}

function getJsonLineColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, position));
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function formatJsonParseError(error: unknown, text: string): string {
  const message = error instanceof Error ? error.message : "Invalid JSON.";
  const positionMatch = message.match(/position\s+(\d+)/i);
  if (!positionMatch) {
    return `JSON is invalid. Expected { "questions": [...] }. ${message}`;
  }

  const { line, column } = getJsonLineColumn(text, Number(positionMatch[1]));
  return `JSON is invalid near line ${line}, column ${column}. Expected { "questions": [...] }.`;
}

function isClosingQuote(str: string, index: number): boolean {
  let nextIndex = index + 1;
  while (nextIndex < str.length && /\s/.test(str[nextIndex])) {
    nextIndex++;
  }
  if (nextIndex >= str.length) {
    return true; // EOF
  }
  
  const nextChar = str[nextIndex];
  if (nextChar === ':' || nextChar === '}' || nextChar === ']') {
    return true;
  }
  
  if (nextChar === ',') {
    let afterCommaIndex = nextIndex + 1;
    while (afterCommaIndex < str.length && /\s/.test(str[afterCommaIndex])) {
      afterCommaIndex++;
    }
    if (afterCommaIndex >= str.length) {
      return true;
    }
    const afterCommaChar = str[afterCommaIndex];
    return afterCommaChar === '"' || afterCommaChar === '{' || afterCommaChar === '[' || afterCommaChar === '}' || afterCommaChar === ']';
  }
  
  return false;
}

function repairJson(jsonStr: string): string {
  let inString = false;
  let escapeActive = false;
  const bracesStack: string[] = [];
  const result: string[] = [];
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (inString) {
      if (escapeActive) {
        escapeActive = false;
        result.push(char);
      } else if (char === '\\') {
        escapeActive = true;
        result.push(char);
      } else if (char === '"') {
        if (isClosingQuote(jsonStr, i)) {
          inString = false;
          result.push(char);
        } else {
          result.push('\\"');
        }
      } else if (char === '\n') {
        result.push('\\n');
      } else if (char === '\r') {
        result.push('\\r');
      } else if (char === '\t') {
        result.push('\\t');
      } else {
        result.push(char);
      }
    } else {
      if (char === '"') {
        inString = true;
        result.push(char);
      } else if (char === '{' || char === '[') {
        bracesStack.push(char);
        result.push(char);
      } else if (char === '}' || char === ']') {
        if (bracesStack.length > 0) {
          const expected = bracesStack[bracesStack.length - 1];
          if ((char === '}' && expected === '{') || (char === ']' && expected === '[')) {
            bracesStack.pop();
          }
        }
        
        let backtrackIndex = result.length - 1;
        while (backtrackIndex >= 0 && /\s/.test(result[backtrackIndex])) {
          backtrackIndex--;
        }
        if (backtrackIndex >= 0 && result[backtrackIndex] === ',') {
          result[backtrackIndex] = '';
        }
        result.push(char);
      } else {
        result.push(char);
      }
    }
  }
  
  if (inString) {
    result.push('"');
  }
  
  while (bracesStack.length > 0) {
    const top = bracesStack.pop();
    if (top === '{') {
      let backtrackIndex = result.length - 1;
      while (backtrackIndex >= 0 && /\s/.test(result[backtrackIndex])) {
        backtrackIndex--;
      }
      if (backtrackIndex >= 0 && result[backtrackIndex] === ',') {
        result[backtrackIndex] = '';
      }
      result.push('}');
    } else if (top === '[') {
      let backtrackIndex = result.length - 1;
      while (backtrackIndex >= 0 && /\s/.test(result[backtrackIndex])) {
        backtrackIndex--;
      }
      if (backtrackIndex >= 0 && result[backtrackIndex] === ',') {
        result[backtrackIndex] = '';
      }
      result.push(']');
    }
  }
  
  return result.join('');
}

function extractTitleFromRawText(rawText: string): string | undefined {
  if (!rawText) return undefined;
  const titleMatch = rawText.match(/(?:^|\n)\s*(?:quiz\s*)?title\s*:\s*([^\n]+)/i);
  if (titleMatch && titleMatch[1].trim()) {
    return titleMatch[1].trim().replace(/^["'*#_\s]+|["'*#_\s]+$/g, "").trim();
  }
  const headerMatch = rawText.match(/(?:^|\n)\s*#+\s*([^\n]+)/);
  if (headerMatch && headerMatch[1].trim()) {
    const cleaned = headerMatch[1].trim().replace(/^["'*#_\s]+|["'*#_\s]+$/g, "").trim();
    if (!/^(?:quizcraft\s*format|end|questions)$/i.test(cleaned)) {
      return cleaned;
    }
  }
  return undefined;
}

// Attempt to parse JSON-style quiz payload (the preferred format).
function parseJsonQuiz(rawText: string): ParseResult | null {
  const cleanedText = extractJsonString(rawText);
  let repairedText = cleanedText;

  try {
    repairedText = jsonrepair(cleanedText);
  } catch {
    repairedText = repairJson(cleanedText);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(repairedText);
  } catch (error) {
    if (looksLikeLegacyQuiz(rawText)) return null;
    return { questions: [], errors: [formatJsonParseError(error, repairedText)] };
  }

  const payload = parsed as QuizJsonPayload | QuizJsonQuestion[];
  const normalizedPayload = Array.isArray(payload)
    ? payload
    : payload.questions
      ? payload
      : payload.quiz?.questions
        ? payload.quiz
        : payload.model?.questions
          ? payload.model
          : payload.data?.questions
            ? payload.data
            : payload;

  const sourceQuestions = Array.isArray(normalizedPayload) ? normalizedPayload : normalizedPayload.questions;
  if (!Array.isArray(sourceQuestions)) {
    return { questions: [], errors: ['Expected { "questions": [...] } or an array of question objects.'] };
  }

  if (!sourceQuestions.some(isRecord)) {
    return { questions: [], errors: ['JSON is invalid. Expected { "questions": [...] }.'] };
  }

  let title = Array.isArray(normalizedPayload) ? undefined : (normalizedPayload.title ? String(normalizedPayload.title).trim() : undefined);
  if (!title) {
    title = extractTitleFromRawText(rawText);
  }

  const errors: string[] = [];
  const questions: Question[] = [];

  sourceQuestions.forEach((rawItem, index) => {
    if (!isRecord(rawItem)) {
      errors.push(`Question ${index + 1}: Expected a question object.`);
      return;
    }

    const item = rawItem as QuizJsonQuestion;
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
        errors.push(`Q${qNum}: MCQ questions need options A, B, C, and D.`);
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
        status: "unseen",
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
        status: "unseen",
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
          status: "unseen",
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
        status: "unseen",
      });
      return;
    }

    errors.push(`Q${qNum}: Unsupported question type.`);
  });

  return { title, questions, errors };
}

// Fallback parser for the legacy plaintext quiz format.
function parseLegacyQuiz(rawText: string): ParseResult {
  const errors: string[] = [];
  const questions: Question[] = [];

  let text = rawText.trim();
  text = text.replace(/===QUIZCRAFT FORMAT===/gi, "").replace(/===END===/gi, "").trim();

  const title = extractTitleFromRawText(rawText);

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
      status: "unseen",
    });
  }

  return { title, questions, errors };
}

/**
 * Parse user-provided quiz text. Tries JSON first, then the legacy format.
 * Returns a `ParseResult` with any parsing errors to show to the user.
 */
export function parseQuiz(rawText: string): ParseResult {
  if (!rawText?.trim()) {
    return { questions: [], errors: ["Input is empty."] };
  }

  const text = rawText.trim().replace(/===QUIZCRAFT FORMAT===/gi, "").replace(/===END===/gi, "").trim();
  if (looksLikeLegacyQuiz(text)) return parseLegacyQuiz(text);
  if (looksLikeJson(text)) return parseJsonQuiz(text) ?? { questions: [], errors: ['Expected { "questions": [...] }.'] };

  return {
    questions: [],
    errors: ['Paste valid JSON like { "questions": [...] }, or use the legacy format starting with Q1.'],
  };
}
