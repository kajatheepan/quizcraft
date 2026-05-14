import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { __test__ } from "@/store/useAppStore";
import type { Question, QuizSettings } from "@/types/quiz";

const settings: QuizSettings = {
  ...DEFAULT_SETTINGS,
  shuffle: false,
  shuffleOptions: false,
};

function makeQuestions(): Question[] {
  return [
    {
      id: 1,
      type: "MCQ",
      question: "Which layer uses frames?",
      options: { A: "Network", B: "Data Link", C: "Transport", D: "Session" },
      answer: "B",
      explanation: "The Data Link Layer uses frames.",
      userAnswer: "A",
      isCorrect: false,
      status: "answered",
      skipped: false,
    },
    {
      id: 2,
      type: "TF",
      question: "CSMA/CD detects collisions.",
      options: {},
      answer: "TRUE",
      explanation: "Collision detection is part of CSMA/CD.",
      userAnswer: null,
      isCorrect: null,
      status: "skipped",
      skipped: true,
    },
  ];
}

function startQuiz() {
  return __test__.reducer(__test__.initialState, {
    type: "START_QUIZ",
    questions: makeQuestions(),
    settings,
  } as any);
}

describe("quiz flow reducer", () => {
  it("starts a quiz with reset question state", () => {
    const state = startQuiz();

    expect(state.view).toBe("quiz");
    expect(state.result).toBeNull();
    expect(state.quiz.questions).toHaveLength(2);
    expect(state.quiz.questions[0].userAnswer).toBeNull();
    expect(state.quiz.questions[0].isCorrect).toBeNull();
    expect(state.quiz.questions[0].status).toBe("unseen");
  });

  it("answering marks correct or wrong and updates stats", () => {
    const started = startQuiz();
    const answered = __test__.reducer(started, {
      type: "ANSWER_QUESTION",
      response: "B",
    } as any);

    expect(answered.quiz.questions[0].status).toBe("answered");
    expect(answered.quiz.questions[0].isCorrect).toBe(true);
    expect(answered.quiz.correct).toBe(1);
    expect(answered.quiz.wrong).toBe(0);
  });

  it("moving past an unanswered question marks it skipped", () => {
    const started = startQuiz();
    const next = __test__.reducer(started, { type: "NEXT_QUESTION" } as any);

    expect(next.quiz.current).toBe(1);
    expect(next.quiz.questions[0].status).toBe("skipped");
    expect(next.quiz.skipped).toBe(1);
  });

  it("finishing marks remaining unanswered questions skipped", () => {
    const started = startQuiz();
    const answered = __test__.reducer(started, {
      type: "ANSWER_QUESTION",
      response: "B",
    } as any);
    const finished = __test__.reducer(answered, { type: "FINISH_QUIZ" } as any);

    expect(finished.view).toBe("results");
    expect(finished.result?.total).toBe(2);
    expect(finished.result?.correct).toBe(1);
    expect(finished.result?.skipped).toBe(1);
    expect(finished.quiz.questions[1].status).toBe("skipped");
  });

  it("retry rebuilds a fresh quiz from original questions and clears result state", () => {
    const finished = __test__.reducer(startQuiz(), { type: "FINISH_QUIZ" } as any);
    const retried = __test__.reducer(finished, { type: "RETRY_QUIZ" } as any);

    expect(retried.view).toBe("quiz");
    expect(retried.result).toBeNull();
    expect(retried.quiz.current).toBe(0);
    expect(retried.quiz.questions.every((question) => question.status === "unseen")).toBe(true);
  });
});
