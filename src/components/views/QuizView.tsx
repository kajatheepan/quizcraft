"use client";

// Quiz view: composes question renderers (MCQ, Fill, DragDrop, TF), timer
// management and AI follow-up helpers. Keep the components in this file
// small and focused on UI behavior; business logic lives in `useAppStore`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { buildAIUrl } from "@/lib/aiLinks";
import { getAILinkSettings, saveAILinkSettings } from "@/lib/storage";
import type { Question } from "@/types/quiz";
import type { AILinkSettings, AIProvider } from "@/types/quiz";

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

/** MCQ options renderer. Shows contextual feedback after a question is
 * graded and prevents interaction when `answered` is true. */
function MCQOptions({
  question,
  answered,
  onAnswer,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (letter: string) => void;
}) {
  const isActuallyAnswered = answered && question.isCorrect !== null;
  return (
    <div>
      {Object.entries(question.options).map(([letter, text]) => {
        const isCorrect = letter === question.answer;
        const isSelected = letter === question.userAnswer;
        const showResult = isActuallyAnswered;

        let btnClass =
          "w-full flex items-center gap-3 px-4 py-3 border border-border rounded-md mb-2 last:mb-0 " +
          "text-left font-sans text-sm text-primary cursor-pointer " +
          "transition-all duration-[150ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

        let pillClass =
          "w-6 h-6 rounded-full bg-border flex items-center justify-center " +
          "font-mono text-xs text-primary flex-shrink-0 transition-colors duration-[150ms] ";

        if (showResult) {
          if (isCorrect && isSelected) {
            // User selected correct answer - show in GREEN
            btnClass += "border-success scale-[1.01] ";
            pillClass += "bg-success !text-bg ";
          } else if (isSelected && !isCorrect) {
            // User selected wrong answer - show in RED
            btnClass += "border-error ";
            pillClass += "bg-error !text-bg ";
          } else if (isCorrect && !isSelected) {
            // Correct answer but user didn't select it - show in ACCENT (informational)
            btnClass += "border-accent ";
            pillClass += "bg-accent !text-bg ";
          } else {
            // Other options - grayed out
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
              {showResult && isCorrect && isSelected
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

/** Typed fill input renderer. Stores a draft and submits on Enter/Submit.
 * `onDraftChange` is used to capture a draft answer for timeout handling. */
function FillInput({
  question,
  answered,
  onAnswer,
  onDraftChange,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (val: string) => void;
  onDraftChange: (val: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipped = question.skipped === true;

  useEffect(() => {
    setValue("");
    onDraftChange("");
    inputRef.current?.focus();
  }, [question.id, onDraftChange]);

  useEffect(() => {
    onDraftChange(value.trim());
  }, [value, onDraftChange]);

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
      {!answered && (
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

/** Drag-and-drop style fill renderer. Supports dragging choices into blanks
 * and submits a normalized array of answers via `onAnswer`. */
function DragDropFill({
  question,
  answered,
  onAnswer,
  onDraftChange,
}: {
  question: Question;
  answered: boolean;
  onAnswer: (val: string[]) => void;
  onDraftChange: (val: string[]) => void;
}) {
  const blanks = useMemo(() => question.blanks ?? [], [question.blanks]);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const skipped = question.skipped === true;

  useEffect(() => {
    setPlacements({});
    onDraftChange(blanks.map(() => ""));
  }, [question.id, blanks, onDraftChange]);

  useEffect(() => {
    onDraftChange(blanks.map((blank) => placements[blank.id] ?? ""));
  }, [blanks, placements, onDraftChange]);

  const handleDrop = (blankId: string, value: string) => {
    if (answered) return;
    setPlacements((current) => ({ ...current, [blankId]: value }));
  };

  const handleSubmit = () => {
    if (answered) return;
    const nextAnswer = blanks.map((blank) => placements[blank.id] ?? "");
    if (nextAnswer.some((value) => !value.trim())) return;
    onAnswer(nextAnswer);
  };

  useEffect(() => {
    if (answered) return;
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

/** True/False options renderer. Mirrors MCQ feedback logic but simplified.
 * Disables interaction when `answered` is true. */
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

    if (answered) {
      if (isCorrect && isSelected) return base + "border-success text-success ";
      if (isCorrect && !isSelected) return base + "border-accent text-accent ";
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
          disabled={answered}
          onClick={() => !answered && onAnswer(val)}
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
  const { state, answerQuestion, nextQuestion, timeoutQuestion, setRemaining, gotoQuestion, showToast } = useAppStore();
  const { quiz } = state;
  const question = quiz.questions[quiz.current] ?? null;
  const [timerDisplay, setTimerDisplay] = useState("");
  const [timerWarning, setTimerWarning] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AILinkSettings>(() => getAILinkSettings());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef<number>(quiz.settings.timerSeconds);
  const prevIndexRef = useRef<number>(quiz.current);
  const draftAnswerRef = useRef<string | string[] | null>(null);

  const updateDraftAnswer = useCallback((response: string | string[]) => {
    draftAnswerRef.current = response;
  }, []);

  useEffect(() => {
    draftAnswerRef.current = null;
  }, [question?.id]);

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

    // Resume from stored remainingSeconds, but keep timed-out questions at 0:00.
    const storedSeconds = question?.remainingSeconds ?? quiz.settings.timerSeconds;
    const start = storedSeconds === 0
      ? 0
      : storedSeconds <= 10
        ? quiz.settings.timerSeconds
        : storedSeconds;
    remainingRef.current = start;
    const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
    setTimerDisplay(fmt(remainingRef.current));
    setTimerWarning(false);

    if (start === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      remainingRef.current--;
      setTimerDisplay(fmt(remainingRef.current));
      if (remainingRef.current <= 10) setTimerWarning(true);
      if (remainingRef.current <= 0) {
        clearInterval(timerRef.current!);
        setRemaining(quiz.current, 0);
        timeoutQuestion(draftAnswerRef.current);
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
    if (quiz.answered) return;
    if (question.type === "MCQ") {
      const map: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
      const letter = map[e.key.toLowerCase()];
      if (letter && question.options[letter]) { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion(letter); }
    }
    if (question.type === "TF") {
      if (e.key.toLowerCase() === "t") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("TRUE"); }
      if (e.key.toLowerCase() === "f") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("FALSE"); }
    }
  }, [question, quiz.answered, answerQuestion, nextQuestion, gotoQuestion, setRemaining]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!question) return null;

  const handleAnswerWrapped = (response: any) => {
    setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds)));
    answerQuestion(response);
  };

  // Compute if the question is ACTUALLY answered (not just skipped)
  const isActuallyAnswered = question.isCorrect !== null;

  const progress = (quiz.current / quiz.questions.length) * 100;
  const isLast = quiz.current === quiz.questions.length - 1;
  const showExplanation = isActuallyAnswered && !question.skipped && question.explanation && quiz.settings.explanationTiming === "after";
  const fillLabel = question.fillMode === "dragdrop" ? "Drag & Drop" : "Fill";
  const followUpPrompt = buildExplainPrompt(question);

  const updateProviderSettings = (
    provider: AIProvider,
    patch: Partial<AILinkSettings[AIProvider]>
  ) => {
    setAiSettings((current) => {
      const next: AILinkSettings = {
        ...current,
        [provider]: {
          ...current[provider],
          ...patch,
        },
      };
      if (provider === "chatgpt") {
        saveAILinkSettings({ chatgpt: next.chatgpt });
      } else {
        saveAILinkSettings({ claude: next.claude });
      }
      return next;
    });
  };

  const openProvider = (provider: AIProvider) => {
    const { url, usedFallback } = buildAIUrl(provider, followUpPrompt, aiSettings);
    if (usedFallback) {
      showToast(`Invalid ${provider === "chatgpt" ? "ChatGPT" : "Claude"} chat reference. Opened a new chat.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getNavigatorButtonClass = (index: number) => {
    const item = quiz.questions[index];
    const base =
      "w-8 h-8 rounded-md text-xs font-mono transition-colors duration-[150ms] " +
      "flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

    if (index === quiz.current) return base + "bg-accent text-bg font-bold ";
    if (item?.isCorrect === true) return base + "bg-success/20 border border-success text-success ";
    if (item?.isCorrect === false) return base + "bg-error/20 border border-error text-error ";
    return base + "bg-bg border border-border text-secondary hover:bg-border ";
  };

  const renderNavigatorGrid = () => (
    <div className="grid grid-cols-5 gap-2">
      {quiz.questions.map((_, i) => (
        <button
          key={`idx-${i}`}
          onClick={() => gotoQuestion(i)}
          data-tutorial="quiz-nav-jump"
          className={getNavigatorButtonClass(i)}
          aria-label={`Jump to question ${i + 1}`}
          aria-current={i === quiz.current ? "step" : undefined}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative">
      <div className="fixed top-[52px] left-0 right-0 h-[3px] bg-border z-[99]" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-[250ms] ease-out" style={{ width: `${progress}%` }} />
      </div>

      <aside
        className={[
          "hidden lg:block fixed top-[52px] right-0 z-40 h-[calc(100vh-52px)] w-[280px]",
          "bg-surface border-l border-border shadow-card transition-transform duration-[250ms] ease-out",
          navigatorOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Question navigation panel"
      >
        <button
          type="button"
          onClick={() => setNavigatorOpen((current) => !current)}
          className={[
            "absolute top-4 -left-8 h-11 w-11 rounded-full bg-accent text-bg text-2xl leading-none",
            "border-2 border-bg shadow-card transition-colors duration-[150ms]",
            "hover:bg-[#6B5FF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          ].join(" ")}
          aria-label={navigatorOpen ? "Collapse question navigator" : "Expand question navigator"}
          aria-expanded={navigatorOpen}
        >
          {navigatorOpen ? "×" : "‹"}
        </button>

        <div className="h-full overflow-y-auto px-4 pt-9 pb-8">
          <div className="rounded-lg border border-border bg-bg p-4 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary">Quiz navigation</h2>
              <span className="text-xs text-secondary">
                {quiz.current + 1} / {quiz.questions.length}
              </span>
            </div>
            {renderNavigatorGrid()}
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <button
                type="button"
                onClick={nextQuestion}
                className="text-left text-accent hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              >
                {isLast ? "Finish review" : "Next question"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="max-w-[760px] mx-auto px-4 pt-10 pb-20">
        <div className="lg:hidden mb-5 rounded-lg border border-border bg-surface p-3">
          <button
            type="button"
            onClick={() => setNavigatorOpen((current) => !current)}
            className="flex w-full items-center justify-between text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            aria-expanded={navigatorOpen}
          >
            <span>
              Questions {quiz.current + 1} / {quiz.questions.length}
            </span>
            <span className="text-secondary">{navigatorOpen ? "Hide" : "Show"}</span>
          </button>
          {navigatorOpen && <div className="mt-3">{renderNavigatorGrid()}</div>}
        </div>

        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-6 py-4 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-secondary">
                Question {quiz.current + 1} of {quiz.questions.length}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xs font-medium uppercase tracking-[0.05em] text-primary bg-border px-2.5 py-0.5 rounded-full">
                  {question.type === "FILL" ? fillLabel : question.type}
                </span>
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

          <div className="px-6 py-7 sm:px-7 sm:py-8">
            <p className="text-md font-medium text-primary leading-relaxed mb-7">{question.question}</p>

            {question.skipped && <p className="text-sm text-secondary mb-4">Skipped</p>}

            {question.type === "MCQ" && (
              <MCQOptions question={question} answered={isActuallyAnswered} onAnswer={handleAnswerWrapped} />
            )}
            {question.type === "FILL" && (
              question.fillMode === "dragdrop" ? (
                <DragDropFill question={question} answered={isActuallyAnswered} onAnswer={handleAnswerWrapped} onDraftChange={updateDraftAnswer} />
              ) : (
                <FillInput question={question} answered={isActuallyAnswered} onAnswer={handleAnswerWrapped} onDraftChange={updateDraftAnswer} />
              )
            )}
            {question.type === "TF" && (
              <TFOptions question={question} answered={isActuallyAnswered} onAnswer={handleAnswerWrapped} />
            )}
          </div>

          {showExplanation && (
            <div className="border-t border-border px-6 py-5 animate-fade-in sm:px-7" aria-live="polite">
              <div>
                <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-2">Explanation</p>
                <p className="text-base text-primary leading-[1.7]">{question.explanation}</p>
              </div>

              <div className="mt-5 rounded-md border border-border bg-bg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-1">AI follow-up</p>
                    <p className="text-xs text-secondary">
                      Opens explanation links using your current ChatGPT and Claude chat settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiSettingsOpen((current) => !current)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-expanded={aiSettingsOpen}
                  >
                    {aiSettingsOpen ? "Hide AI settings" : "Change AI settings"}
                  </button>
                </div>

                {aiSettingsOpen && (
                  <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                    {(["chatgpt", "claude"] as AIProvider[]).map((provider) => {
                      const label = provider === "chatgpt" ? "ChatGPT" : "Claude";
                      const config = aiSettings[provider];

                      return (
                        <div key={provider}>
                          <p className="text-sm text-primary mb-2">{label}</p>
                          <div className="flex gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => updateProviderSettings(provider, { mode: "new" })}
                              className={`px-3 py-1.5 rounded-md border text-xs transition-colors duration-[150ms] ${
                                config.mode === "new"
                                  ? "border-accent text-primary bg-accent/10"
                                  : "border-border text-secondary hover:text-primary"
                              }`}
                            >
                              New chat
                            </button>
                            <button
                              type="button"
                              onClick={() => updateProviderSettings(provider, { mode: "continue" })}
                              className={`px-3 py-1.5 rounded-md border text-xs transition-colors duration-[150ms] ${
                                config.mode === "continue"
                                  ? "border-accent text-primary bg-accent/10"
                                  : "border-border text-secondary hover:text-primary"
                              }`}
                            >
                              Continue chat
                            </button>
                          </div>
                          <input
                            type="text"
                            disabled={config.mode === "new"}
                            value={config.conversationRef}
                            onChange={(event) => updateProviderSettings(provider, { conversationRef: event.target.value })}
                            placeholder={config.mode === "new" ? "Select continue to paste URL" : "Paste chat URL or ID"}
                            className={`w-full h-9 rounded-md px-3 text-sm transition-colors duration-[150ms] focus:outline-none ${
                              config.mode === "new"
                                ? "bg-surface border border-border text-secondary placeholder:text-secondary/50 cursor-not-allowed opacity-50"
                                : "bg-bg border border-border text-primary placeholder:text-secondary focus:border-accent"
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openProvider("chatgpt")}
                    data-tutorial="quiz-explain-ai"
                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms]"
                  >
                    Explain in ChatGPT ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => openProvider("claude")}
                    data-tutorial="quiz-explain-ai"
                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms]"
                  >
                    Explain in Claude ↗
                  </button>
                </div>
                <p className="text-xs text-secondary mt-2">
                  These buttons open the chosen AI provider in a new tab to show an extended explanation. You can also copy the follow-up prompt and use it in your AI chat manually.
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-border px-6 py-4 sm:px-7">
            <div className="flex flex-wrap items-center gap-3 animate-fade-in">
              <button
                onClick={() => gotoQuestion(Math.max(0, quiz.current - 1))}
                disabled={quiz.current === 0}
                className="text-secondary text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm disabled:opacity-40"
              >
                ← Previous
              </button>

              {isActuallyAnswered && (
                <>
                  <button
                    onClick={nextQuestion}
                    className="text-accent text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  >
                    {isLast ? "See results →" : "Next question →"}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
