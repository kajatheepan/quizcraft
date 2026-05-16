// ── QUIZ ENGINE ───────────────────────────────────────────────────────────────
// Utility helpers to prepare quizzes, shuffle options, check answers and build
// result payloads. Keep pure functions here for easy unit testing.

import type { ExplanationStyle, PromptMode, Question, QuizSettings, ResultData } from "@/types/quiz";

/** Return a new array with elements shuffled using Fisher–Yates. */
export function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle MCQ option order while remapping the answer key. */
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

// Normalization helper used for comparing free text answers.
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

// Turn various answer shapes into a normalized array of non-empty strings.
function normalizeAnswerList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const answers = Array.isArray(value) ? value : [value];
  return answers.map((answer) => answer.trim()).filter((answer) => answer.length > 0);
}

// Compare two arrays of answers after normalizing each item.
function arraysMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => normalizeText(item) === normalizeText(right[index]));
}

/** Prepare a fresh quiz round: reset per-question state and apply shuffling. */
export function prepareQuestions(questions: Question[], settings: QuizSettings): Question[] {
  let qs: Question[] = questions.map((q) => ({
    ...q,
    userAnswer: null,
    isCorrect: null,
    status: "unseen",
    skipped: false,
    remainingSeconds: settings.timerSeconds,
  }));
  if (settings.shuffle) qs = fisherYates(qs);
  if (settings.shuffleOptions) qs = qs.map(shuffleOptions);
  return qs;
}

/**
 * Check whether the provided `response` matches a question's answer.
 * Handles MCQ/TF, typed fill and drag/drop fill modes.
 */
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

/** Count score data from the question list, which is the source of truth. */
export function getQuestionStats(questions: Question[]) {
  return {
    correct: questions.filter((question) => question.status === "answered" && question.isCorrect === true).length,
    wrong: questions.filter((question) => question.status === "answered" && question.isCorrect === false).length,
    skipped: questions.filter((question) => question.status === "skipped").length,
  };
}

/** Build the result payload shown on the results screen. */
export function buildResultData(questions: Question[]): ResultData {
  const { correct, wrong, skipped } = getQuestionStats(questions);
  return {
    questions,
    correct,
    wrong,
    skipped,
    total: questions.length,
    percentage: Math.round((correct / questions.length) * 100),
  };
}

/** Friendly message for a score percentage. */
export function getScoreMessage(percentage: number): string {
  if (percentage >= 90) return "Excellent work.";
  if (percentage >= 70) return "Good job — nearly there.";
  if (percentage >= 50) return "Keep reviewing.";
  return "More practice needed.";
}

/** Build a deterministic prompt to send to an LLM to generate quiz JSON. */
export function buildPrompt(
  subject: string,
  count: number,
  types: Set<string>,
  difficulty: string,
  focus: string,
  explanationStyle: ExplanationStyle = "short",
  promptMode: PromptMode = "guided"
): string {
  const subjectStr = subject.trim() || "[YOUR TOPIC]";
  const typeList = Array.from(types).join(", ") || "MCQ";
  const focusLine = focus.trim() ? `\nFocus areas: ${focus.trim()}` : "";
  const explanationRule = explanationStyle === "full"
    ? `- Explanations must be detailed Markdown inside the JSON string.
- Prefer clear paragraphs and short bullet/numbered lists for most explanations.
- Use Markdown tables only when comparing multiple items, categories, steps, or differences. Do not include a table when a normal explanation is clearer.
- Use fenced code blocks or text-based diagrams only when they genuinely help explain structure, flow, syntax, or process. Do not add diagrams to every answer.
- Do not use raw HTML, SVG, or external images.
- Escape newlines correctly so the response remains valid JSON.`
    : "- Explanations must be short plain text: one or two sentences only.";
  const explanationExample = explanationStyle === "full"
    ? "### Why this is correct\\nExplain the concept in clear paragraphs. Use bullets, tables, or diagrams only if they make this specific explanation clearer."
    : "Short explanation";

  const formatIntro = promptMode === "format"
    ? `Use this QuizCraft JSON format for your quiz output. Return ONLY valid JSON. Do not wrap the response in markdown.

You can write your own quiz instructions above this format in ChatGPT or Claude. The final answer must still follow this exact JSON contract.`
    : `You are an expert university-level quiz designer. Return ONLY valid JSON. Do not wrap the response in markdown.

Generate ${count} quiz questions about "${subjectStr}".
Question types allowed: ${typeList}.
Difficulty: ${difficulty}.${focusLine}
Explanation detail: ${explanationStyle === "full" ? "Full Markdown" : "Short"}.

Source policy:
- First use the uploaded files, lecture slides, PDFs, notes, or project/chat knowledge available in this conversation.
- If sources are available, base the questions on those sources instead of generic internet-style knowledge.
- If the sources do not contain enough material, still generate useful questions from the topic, but do not invent fake slide names, page numbers, or unsupported facts.

Question quality policy:
- Write questions for university students, not school-level memorization.
- Prefer concept application, comparison, cause/effect, troubleshooting, scenario analysis, and common misconception testing.
- Avoid silly word-play, obvious definition-only questions, and questions that can be answered by matching one highlighted word from the notes.
- Make distractors plausible and based on real confusions students make.
- Include a balanced mix of difficulty. Most questions should require thinking, not just recall.
- Do not ask vague questions like "Which is correct?" unless every option is precise and meaningful.`;

  return `${formatIntro}

Use this exact JSON shape:
{
  "questions": [
    {
      "id": 1,
      "type": "MCQ",
      "question": "Question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "B",
      "explanation": "${explanationExample}"
    },
    {
      "id": 2,
      "type": "FILL",
      "fillMode": "typed",
      "question": "The MAC address is ___ bits long.",
      "answer": "48",
      "acceptedAnswers": ["48", "forty eight", "forty-eight"],
      "explanation": "${explanationExample}"
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
      "explanation": "${explanationExample}"
    },
    {
      "id": 4,
      "type": "TF",
      "question": "True or false question",
      "answer": "TRUE",
      "explanation": "${explanationExample}"
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
${explanationRule}
- Number questions sequentially from 1 to ${count}.`;
}
