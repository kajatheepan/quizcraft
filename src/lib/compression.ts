import type { Question } from "@/types/quiz";

const JSON_FALLBACK_PREFIX = "j.";

// ── SCHEMA MINIFICATION MAP ──────────────────────────────────────────────────
// Minifies the JSON key names to single characters to save space in the URL.
// E.g. {"question": "..."} becomes {"x": "..."}

export function minifyQuiz(questions: Question[]): any[] {
  return questions.map(q => {
    const m: any = {
      i: q.id,
      t: q.type,
      x: q.question,
      a: q.answer,
    };

    if (q.options && Object.keys(q.options).length > 0) {
      m.o = q.options;
    }
    if (q.explanation) {
      m.e = q.explanation;
    }
    if (q.fillMode) {
      m.f = q.fillMode;
    }
    if (q.acceptedAnswers && q.acceptedAnswers.length > 0) {
      m.y = q.acceptedAnswers;
    }
    if (q.blanks && q.blanks.length > 0) {
      m.b = q.blanks.map(blk => ({
        i: blk.id,
        a: blk.answer,
        y: blk.acceptedAnswers
      }));
    }
    if (q.choices && q.choices.length > 0) {
      m.c = q.choices;
    }

    return m;
  });
}

export function expandQuiz(minified: any[]): Question[] {
  return minified.map(m => ({
    id: m.i,
    type: m.t,
    question: m.x,
    options: m.o || {},
    answer: m.a,
    explanation: m.e || "",
    fillMode: m.f,
    acceptedAnswers: m.y,
    blanks: m.b?.map((blk: any) => ({
      id: blk.i,
      answer: blk.a,
      acceptedAnswers: blk.y
    })),
    choices: m.c,
    userAnswer: null,
    isCorrect: null,
    status: "unseen"
  }));
}

// ── BINARY COMPRESSION & BASE64 ENCODING ──────────────────────────────────────

function bytesToBase64Url(uint8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(compressedBase64: string): Uint8Array {
  let base64 = compressedBase64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }

  // Convert Base64 back to binary string and then Uint8Array
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function parseQuizJson(text: string): Question[] {
  const parsed = JSON.parse(text);
  if (!parsed.q || !Array.isArray(parsed.q)) {
    throw new Error("Invalid shared quiz format");
  }

  return expandQuiz(parsed.q);
}

/**
 * Compresses a questions array into a URL-safe Base64 string.
 */
export async function compressQuiz(questions: Question[]): Promise<string> {
  const minified = minifyQuiz(questions);
  const jsonStr = JSON.stringify({ q: minified });

  // Convert string to Uint8Array bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonStr);

  if (typeof CompressionStream === "undefined") {
    return `${JSON_FALLBACK_PREFIX}${bytesToBase64Url(bytes)}`;
  }

  // Compress using CompressionStream (Deflate algorithm)
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const compressedStream = stream.pipeThrough(new CompressionStream("deflate"));
  const response = new Response(compressedStream);
  const buffer = await response.arrayBuffer();

  return bytesToBase64Url(new Uint8Array(buffer));
}

/**
 * Decompresses a URL-safe Base64 string back into a questions array.
 */
export async function decompressQuiz(compressedBase64: string): Promise<Question[]> {
  if (!compressedBase64) {
    throw new Error("Empty compressed string");
  }

  if (compressedBase64.startsWith(JSON_FALLBACK_PREFIX)) {
    const bytes = base64UrlToBytes(compressedBase64.slice(JSON_FALLBACK_PREFIX.length));
    const text = new TextDecoder().decode(bytes);
    return parseQuizJson(text);
  }

  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open compressed quiz links");
  }

  const bytes = base64UrlToBytes(compressedBase64);

  // Decompress using DecompressionStream
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const decompressedStream = stream.pipeThrough(new DecompressionStream("deflate"));
  const response = new Response(decompressedStream);
  const text = await response.text();

  return parseQuizJson(text);
}
