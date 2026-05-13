"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { buildAIUrl } from "@/lib/aiLinks";
import { getAILinkSettings } from "@/lib/storage";
import type { Question } from "@/types/quiz";
import type { AIProvider } from "@/types/quiz";

function buildExplainPrompt(question: Question): string {
  const userAnswer = question.skipped
    ? "(skipped)"
    : Array.isArray(question.userAnswer)
      ? question.userAnswer.join(" | ")
      : (question.userAnswer ?? "(skipped)");
  const correctAnswer = Array.isArray(question.answer)
    ? question.answer.join(" | ")
    : question.answer;

  return [
    "I am taking a quiz on this material and was given this question:",
    "",
    `'${question.question}'`,
    "",
    `I chose this as the answer: '${userAnswer}'`,
    "",
    `That answer was ${question.isCorrect ? "correct" : "incorrect"}. The correct answer is '${correctAnswer}'.`,
    "",
    `Explanation shown in quiz: '${question.explanation || "(none)"}'`,
    "",
    "Help me understand this clearly in simple steps and include a quick memory tip.",
  ].join("\n");
}

// ── MCQ OPTIONS ──────────────────────────────────────────────────────────────

function MCQOptions({
  question,
  answered,
  onAnswer,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (letter: string) => void;
}) {
  const skipped = question.skipped === true;
  return (
    <div>
      {Object.entries(question.options).map(([letter, text]) => {
        const isCorrect = letter === question.answer;
        const isSelected = letter === question.userAnswer;
        const showResult = answered;

        let btnClass =
          "w-full flex items-center gap-3 px-4 py-3 border border-border rounded-md mb-2 last:mb-0 " +
          "text-left font-sans text-sm text-primary cursor-pointer " +
          "transition-all duration-[150ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

        let pillClass =
          "w-6 h-6 rounded-full bg-border flex items-center justify-center " +
          "font-mono text-xs text-primary flex-shrink-0 transition-colors duration-[150ms] ";

        if (skipped) {
          btnClass += "opacity-45 ";
        } else if (showResult) {
          if (isCorrect) {
            btnClass += "border-success scale-[1.01] ";
            pillClass += "bg-success !text-bg ";
          } else if (isSelected && !isCorrect) {
            btnClass += "border-error ";
            pillClass += "bg-error !text-bg ";
          } else {
            btnClass += "opacity-40 ";
          }
        } else {
          btnClass += "hover:border-accent ";
        }

        return (
          <button
            key={letter}
            disabled={answered}
            onClick={() => !answered && onAnswer(letter)}
            aria-label={`Option ${letter}: ${text}`}
            className={btnClass}
          >
            <span className={pillClass}>
              {skipped
                ? letter
                : showResult && isCorrect
                ? "✓"
                : showResult && isSelected && !isCorrect
                ? "✗"
                : letter}
            </span>
            <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── FILL INPUT ────────────────────────────────────────────────────────────────

function FillInput({
  question,
  answered,
  onAnswer,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (val: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipped = question.skipped === true;

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [question.id]);

  const submit = () => {
    if (!value.trim() || answered) return;
    onAnswer(value.trim());
  };

  const isCorrect = answered && question.isCorrect === true;
  const isWrong = answered && question.isCorrect === false;

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={answered}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Your answer..."
        aria-label="Your answer"
        className={`
          w-full h-12 bg-bg border rounded-md px-4 text-base text-primary font-sans
          placeholder:text-secondary transition-colors duration-[150ms]
          focus:outline-none focus:border-accent disabled:cursor-default
          ${skipped ? "border-border opacity-60" : isCorrect ? "border-success" : isWrong ? "border-error" : "border-border"}
        `}
      />
      {!answered && !skipped && (
        <div className="flex justify-end mt-2.5">
          <button
            onClick={submit}
            className="border border-border text-primary text-sm px-3.5 py-1.5 rounded-md
                       hover:border-secondary transition-colors duration-[150ms]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Submit
          </button>
        </div>
      )}
      {answered && !skipped && (
        <p className={`text-sm mt-2 ${isCorrect ? "text-success" : "text-error"}`}>
          {isCorrect ? "✓ Correct" : `✗ Answer: ${question.answer}`}
        </p>
      )}
    </div>
  );
}

// ── DRAG / DROP FILL ─────────────────────────────────────────────────────────

function DragDropFill({
  question,
  answered,
  onAnswer,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (val: string[]) => void;
}) {
  const blanks = question.blanks ?? [];
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const skipped = question.skipped === true;

  useEffect(() => {
    setPlacements({});
  }, [question.id]);

  const handleDrop = (blankId: string, value: string) => {
    if (answered || skipped) return;
    setPlacements((current) => ({ ...current, [blankId]: value }));
  };

  const handleSubmit = () => {
    if (answered || skipped) return;
    const nextAnswer = blanks.map((blank) => placements[blank.id] ?? "");
    if (nextAnswer.some((value) => !value.trim())) return;
    onAnswer(nextAnswer);
  };

  useEffect(() => {
    if (answered || skipped) return;
    const onEnterSubmit = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSubmit();
    };
    window.addEventListener("keydown", onEnterSubmit);
    return () => window.removeEventListener("keydown", onEnterSubmit);
  }, [answered, placements, question.id]);

  const renderedQuestion = question.question.split(/\[\[(\d+)\]\]/g).map((part, index) => {
    if (index % 2 === 0) {
      return <span key={`${question.id}-text-${index}`}>{part}</span>;
    }

    const blank = blanks.find((item) => item.id === part);
    const currentValue = placements[part] ?? "";
    const isFilled = Boolean(currentValue);
    const isCorrect = answered && blank ? normalizeAnswer(currentValue) === normalizeAnswer(blank.answer) : false;

    return (
      <button
        key={`${question.id}-blank-${part}`}
        type="button"
        disabled={answered}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const value = event.dataTransfer.getData("text/plain");
          if (value) handleDrop(part, value);
        }}
        className={[
          "inline-flex min-w-[110px] items-center justify-center align-middle mx-1 px-3 py-1.5 rounded-md border border-dashed",
          "text-sm transition-colors duration-[150ms]",
          answered
            ? isCorrect && isFilled
              ? "border-success text-success bg-success/5"
              : "border-error text-error bg-error/5"
            : isFilled
              ? "border-accent text-primary bg-accent/5"
              : "border-border text-secondary bg-bg",
        ].join(" ")}
      >
        {currentValue || `Blank ${part}`}
      </button>
    );
  });

  const choices = question.choices ?? [];
  const showFeedback = answered && question.isCorrect !== null && !skipped;

  return (
    <div>
      <div className="text-base text-primary leading-[1.8] mb-5">{renderedQuestion}</div>

      <div className="flex flex-wrap gap-2 mb-4">
        {choices.map((choice, index) => (
          <button
            key={`${question.id}-choice-${index}-${choice}`}
            type="button"
            draggable={!answered}
            disabled={answered}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", choice)}
            className={[
              "px-3 py-2 rounded-full border text-sm transition-colors duration-[150ms]",
              answered ? "border-border text-secondary" : "border-border text-primary hover:border-accent cursor-grab active:cursor-grabbing",
            ].join(" ")}
          >
            {choice}
          </button>
        ))}
      </div>

      {!answered && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="border border-border text-primary text-sm px-3.5 py-1.5 rounded-md
                       hover:border-secondary transition-colors duration-[150ms]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Submit
          </button>
        </div>
      )}

      {showFeedback && (
        <p className={`text-sm mt-2 ${question.isCorrect ? "text-success" : "text-error"}`}>
          {question.isCorrect ? "✓ Correct" : `✗ Answer: ${(question.answer as string[]).join(" • ")}`}
        </p>
      )}
    </div>
  );
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── TRUE / FALSE ──────────────────────────────────────────────────────────────

function TFOptions({
  question,
  answered,
  onAnswer,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (val: string) => void;
}) {
  const skipped = question.skipped === true;
  const getBtnClass = (val: string) => {
    const isCorrect = val === question.answer;
    const isSelected = val === question.userAnswer;
    const isUnanswered = answered && !question.userAnswer && !skipped;
    let base =
      "flex-1 h-12 border border-border rounded-md text-base font-sans " +
      "transition-all duration-[150ms] ease-out " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

    if (skipped) return base + "opacity-45 text-primary ";
    if (answered) {
      if (isCorrect && isSelected) return base + "border-success text-success ";
      if (isUnanswered) return base + "border-error text-error ";
      if (isSelected && !isCorrect) return base + "border-error text-error ";
      return base + "opacity-40 text-primary ";
    }
    return base + "text-primary hover:border-accent cursor-pointer ";
  };

  return (
    <div className="flex gap-3">
      {["TRUE", "FALSE"].map((val) => (
        <button
          key={val}
          disabled={answered || skipped}
          onClick={() => !answered && !skipped && onAnswer(val)}
          className={getBtnClass(val)}
        >
          {val === "TRUE" ? "True" : "False"}
        </button>
      ))}
    </div>
  );
}

// ── MAIN QUIZ VIEW ────────────────────────────────────────────────────────────

export default function QuizView() {
  const { state, answerQuestion, nextQuestion, skipQuestion, timeoutQuestion, setRemaining, gotoQuestion, showToast } = useAppStore();
  const { quiz } = state;
  const question = quiz.questions[quiz.current] ?? null;
  const [timerDisplay, setTimerDisplay] = useState("");
  const [timerWarning, setTimerWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef<number>(quiz.settings.timerSeconds);
  const prevIndexRef = useRef<number>(quiz.current);

  // Timer
  useEffect(() => {
    if (!quiz.settings.timer) { setTimerDisplay(""); return; }

    // Persist previous question's remaining time when switching questions
    const prev = prevIndexRef.current;
    if (prev !== quiz.current && typeof remainingRef.current === "number") {
      setRemaining(prev, Math.max(0, Math.floor(remainingRef.current)));
    }
    prevIndexRef.current = quiz.current;

    if (quiz.answered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Resume from stored remainingSeconds or full timer
    const start = (question?.remainingSeconds ?? quiz.settings.timerSeconds) <= 10
      ? quiz.settings.timerSeconds
      : (question?.remainingSeconds ?? quiz.settings.timerSeconds);
    remainingRef.current = start;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
    setTimerDisplay(fmt(remainingRef.current));
    setTimerWarning(false);

    timerRef.current = setInterval(() => {
      remainingRef.current--;
      setTimerDisplay(fmt(remainingRef.current));
      if (remainingRef.current <= 10) setTimerWarning(true);
      if (remainingRef.current <= 0) {
        clearInterval(timerRef.current!);
        setRemaining(quiz.current, 0);
        timeoutQuestion();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof remainingRef.current === "number") setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current)));
    };
  }, [quiz.current, quiz.answered]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!question) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); gotoQuestion(Math.max(0, quiz.current - 1)); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); nextQuestion(); return; }
    if (quiz.answered) {
      if (e.key.toLowerCase() === "n") { e.preventDefault(); nextQuestion(); }
      return;
    }
    if (question.type === "MCQ") {
      const map: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
      const letter = map[e.key.toLowerCase()];
      if (letter && question.options[letter]) { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion(letter); }
    }
    if (e.key.toLowerCase() === "s") { e.preventDefault(); setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); skipQuestion(); return; }
    if (question.type === "TF") {
      if (e.key.toLowerCase() === "t") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("TRUE"); }
      if (e.key.toLowerCase() === "f") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("FALSE"); }
    }
  }, [question, quiz.answered, answerQuestion, nextQuestion, gotoQuestion, skipQuestion, setRemaining]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!question) return null;

  const handleAnswerWrapped = (response: any) => {
    setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds)));
    answerQuestion(response);
  };

  const handleSkipWrapped = () => {
    setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds)));
    skipQuestion();
  };

  const progress = (quiz.current / quiz.questions.length) * 100;
  const isLast = quiz.current === quiz.questions.length - 1;
  const showExplanation = quiz.answered && !question.skipped && question.explanation && quiz.settings.explanationTiming === "after";
  const fillLabel = question.fillMode === "dragdrop" ? "Drag & Drop" : "Fill";
  const followUpPrompt = buildExplainPrompt(question);

  const openProvider = (provider: AIProvider) => {
    const { url, usedFallback } = buildAIUrl(provider, followUpPrompt, getAILinkSettings());
    if (usedFallback) {
      showToast(`Invalid ${provider === "chatgpt" ? "ChatGPT" : "Claude"} chat reference. Opened a new chat.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative">
      <div className="fixed top-[52px] left-0 right-0 h-[3px] bg-border z-[99]" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-[250ms] ease-out" style={{ width: `${progress}%` }} />
      </div>

      <div className="max-w-content-md mx-auto px-4 pt-10 pb-20">
        <div className="mb-6">
          <div className="grid grid-cols-6 gap-2 mb-6">
            {quiz.questions.map((_, i) => (
              <button
                key={`idx-${i}`}
                onClick={() => gotoQuestion(i)}
                className={`w-8 h-8 rounded-md text-xs font-mono transition-colors duration-[150ms] flex items-center justify-center ${
                  i === quiz.current
                    ? "bg-accent text-bg font-bold"
                    : quiz.questions[i]?.isCorrect === true
                    ? "bg-success/20 border border-success text-success"
                    : quiz.questions[i]?.isCorrect === false
                    ? "bg-error/20 border border-error text-error"
                    : "bg-bg border border-border text-secondary hover:bg-border"
                }`}
                aria-label={`Jump to question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-secondary">
              Question {quiz.current + 1} of {quiz.questions.length}
            </div>
            <span className="text-2xs font-medium uppercase tracking-[0.05em] text-primary bg-border px-2.5 py-0.5 rounded-full">
              {question.type === "FILL" ? fillLabel : question.type}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-secondary" aria-live="polite">
                ✓ {quiz.correct}{"  "}✗ {quiz.wrong}
              </span>
              {quiz.settings.timer && timerDisplay && (
                <span className={`text-sm font-mono min-w-[36px] text-right ${timerWarning ? "text-error" : "text-secondary"}`} aria-label="Time remaining">
                  {timerDisplay}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-7 shadow-card">
          <p className="text-md font-medium text-primary leading-relaxed mb-6">{question.question}</p>

          {question.skipped && <p className="text-sm text-secondary mb-4">Skipped</p>}

          {question.type === "MCQ" && (
            <MCQOptions question={question} answered={quiz.answered} onAnswer={handleAnswerWrapped} />
          )}
          {question.type === "FILL" && (
            question.fillMode === "dragdrop" ? (
              <DragDropFill question={question} answered={quiz.answered} onAnswer={handleAnswerWrapped} />
            ) : (
              <FillInput question={question} answered={quiz.answered} onAnswer={handleAnswerWrapped} />
            )
          )}
          {question.type === "TF" && (
            <TFOptions question={question} answered={quiz.answered} onAnswer={handleAnswerWrapped} />
          )}
        </div>

        {showExplanation && (
          <div className="mt-5 pt-5 border-t border-border animate-fade-in" aria-live="polite">
            <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-2">Explanation</p>
            <p className="text-base text-secondary leading-[1.7]">{question.explanation}</p>
            <p className="text-xs text-secondary mt-2">Opens using your configured AI chat mode.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openProvider("chatgpt")}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms]"
              >
                Explain in ChatGPT ↗
              </button>
              <button
                type="button"
                onClick={() => openProvider("claude")}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms]"
              >
                Explain in Claude ↗
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 animate-fade-in">
          <button
            onClick={() => gotoQuestion(Math.max(0, quiz.current - 1))}
            disabled={quiz.current === 0}
            className="text-secondary text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm disabled:opacity-40"
          >
            ← Previous
          </button>

          {!quiz.answered && (
            <button
              onClick={handleSkipWrapped}
              className="ml-2 text-error text-sm hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              Skip
            </button>
          )}

          {quiz.answered && (
            <>
              <button
                onClick={nextQuestion}
                className="text-accent text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              >
                {isLast ? "See results →" : "Next question →"}
              </button>
              <span className="text-xs text-secondary">or press N</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
