"use client";

// Quiz view: composes question renderers (MCQ, Fill, DragDrop, TF), timer
// management and AI follow-up helpers. Keep the components in this file
// small and focused on UI behavior; business logic lives in `useAppStore`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { buildAIUrl } from "@/lib/aiLinks";
import { copyToClipboard } from "@/lib/clipboard";
import { getShareLinkForQuiz, waitForCachedShareLinkAnimation } from "@/lib/shareLinks";
import { getAILinkSettings, saveAILinkSettings } from "@/lib/storage";
import type { Question } from "@/types/quiz";
import type { AILinkSettings, AIProvider } from "@/types/quiz";
import { Copy, Settings, Share2, X } from "lucide-react";

type ConfirmAction =
  | { type: "next" }
  | { type: "finish" }
  | { type: "goto"; index: number };

function buildExplainPrompt(question: Question): string {
  const userAnswer = question.status === "skipped" || question.status === "timedOut"
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
  locked,
  revealAnswer,
  onAnswer,
}: {
  question: Question;
  locked: boolean;
  revealAnswer: boolean;
  onAnswer: (letter: string) => void;
}) {
  return (
    <div>
      {Object.entries(question.options).map(([letter, text]) => {
        const isCorrect = letter === question.answer;
        const isSelected = letter === question.userAnswer;
        const showResult = revealAnswer && question.isCorrect !== null;

        let btnClass =
          "w-full flex items-center gap-3 px-3 py-3 border border-border rounded-md mb-2 last:mb-0 sm:px-4 " +
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
        } else if (locked && isSelected) {
          btnClass += "border-accent bg-accent/5 ";
          pillClass += "bg-accent/20 text-primary ";
        } else if (locked) {
          btnClass += "opacity-50 cursor-not-allowed ";
        } else {
          btnClass += "hover:border-accent ";
        }

        return (
          <button
            key={letter}
            type="button"
            disabled={locked}
            onClick={() => !locked && onAnswer(letter)}
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
  locked,
  revealAnswer,
  onAnswer,
  onDraftChange,
}: {
  question: Question;
  locked: boolean;
  revealAnswer: boolean;
  onAnswer: (val: string) => void;
  onDraftChange: (val: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipped = question.status === "skipped" || question.status === "timedOut";

  useEffect(() => {
    setValue("");
    onDraftChange("");
    inputRef.current?.focus();
  }, [question.id, onDraftChange]);

  useEffect(() => {
    onDraftChange(value.trim());
  }, [value, onDraftChange]);

  const submit = () => {
    if (!value.trim() || locked) return;
    onAnswer(value.trim());
  };

  const hasTypedAnswer = Boolean(value.trim());
  const isCorrect = revealAnswer && question.isCorrect === true;
  const isWrong = revealAnswer && question.isCorrect === false;

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={locked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Your answer..."
        aria-label="Your answer"
        className={`
          w-full h-12 bg-bg border rounded-md px-4 text-base text-primary font-sans
          placeholder:text-secondary transition-colors duration-[150ms]
          focus:outline-none focus:border-accent disabled:cursor-default
          ${question.status === "timedOut" ? "border-border opacity-60" : isCorrect ? "border-success" : isWrong ? "border-error" : "border-border"}
        `}
      />
      {!locked && (
        <div className="flex justify-end mt-2.5">
          <button
            type="button"
            onClick={submit}
            disabled={!hasTypedAnswer}
            className={[
              "border border-border text-sm px-3.5 py-1.5 rounded-md transition-colors duration-[150ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              hasTypedAnswer
                ? "text-primary hover:border-secondary"
                : "text-secondary opacity-50 cursor-not-allowed",
            ].join(" ")}
          >
            Submit
          </button>
        </div>
      )}
      {revealAnswer && !skipped && (
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
  locked,
  revealAnswer,
  onAnswer,
  onDraftChange,
}: {
  question: Question;
  locked: boolean;
  revealAnswer: boolean;
  onAnswer: (val: string[]) => void;
  onDraftChange: (val: string[]) => void;
}) {
  const blanks = useMemo(() => question.blanks ?? [], [question.blanks]);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const skipped = question.status === "skipped" || question.status === "timedOut";

  useEffect(() => {
    setPlacements({});
    onDraftChange(blanks.map(() => ""));
  }, [question.id, blanks, onDraftChange]);

  useEffect(() => {
    onDraftChange(blanks.map((blank) => placements[blank.id] ?? ""));
  }, [blanks, placements, onDraftChange]);

  const handleDrop = (blankId: string, value: string) => {
    if (locked) return;
    setPlacements((current) => ({ ...current, [blankId]: value }));
  };

  const handleSubmit = () => {
    if (locked) return;
    const nextAnswer = blanks.map((blank) => placements[blank.id] ?? "");
    if (nextAnswer.some((value) => !value.trim())) return;
    onAnswer(nextAnswer);
  };

  useEffect(() => {
    if (locked) return;
    const onEnterSubmit = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSubmit();
    };
    window.addEventListener("keydown", onEnterSubmit);
    return () => window.removeEventListener("keydown", onEnterSubmit);
  }, [locked, placements, question.id]);

  const renderedQuestion = question.question.split(/\[\[(\d+)\]\]/g).map((part, index) => {
    if (index % 2 === 0) {
      return <span key={`${question.id}-text-${index}`}>{part}</span>;
    }

    const blank = blanks.find((item) => item.id === part);
    const currentValue = placements[part] ?? "";
    const isFilled = Boolean(currentValue);
    const isCorrect = revealAnswer && blank ? normalizeAnswer(currentValue) === normalizeAnswer(blank.answer) : false;

    return (
      <button
        key={`${question.id}-blank-${part}`}
        type="button"
        disabled={locked}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const value = event.dataTransfer.getData("text/plain");
          if (value) handleDrop(part, value);
        }}
        className={[
          "inline-flex min-w-[110px] items-center justify-center align-middle mx-1 px-3 py-1.5 rounded-md border border-dashed",
          "text-sm transition-colors duration-[150ms]",
          revealAnswer
            ? isCorrect && isFilled
              ? "border-success text-success bg-success/5"
              : "border-error text-error bg-error/5"
            : locked && isFilled
              ? "border-accent text-primary bg-accent/5"
              : locked
                ? "border-border text-secondary bg-bg opacity-60"
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
  const showFeedback = revealAnswer && question.isCorrect !== null && !skipped;
  const allBlanksFilled = blanks.length > 0 && blanks.every((blank) => (placements[blank.id] ?? "").trim());

  return (
    <div>
      <div className="text-base text-primary leading-[1.8] mb-5">{renderedQuestion}</div>

      <div className="flex flex-wrap gap-2 mb-4">
        {choices.map((choice, index) => (
          <button
            key={`${question.id}-choice-${index}-${choice}`}
            type="button"
            draggable={!locked}
            disabled={locked}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", choice)}
            className={[
              "px-3 py-2 rounded-full border text-sm transition-all duration-[150ms]",
              locked
                ? "border-border text-secondary"
                : "border-border bg-surface text-primary shadow-card cursor-grab hover:-translate-y-0.5 hover:border-accent hover:shadow-md active:translate-y-0 active:shadow-sm active:cursor-grabbing",
            ].join(" ")}
          >
            {choice}
          </button>
        ))}
      </div>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allBlanksFilled}
            className={[
              "border border-border text-sm px-3.5 py-1.5 rounded-md transition-colors duration-[150ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              allBlanksFilled
                ? "text-primary hover:border-secondary"
                : "text-secondary opacity-50 cursor-not-allowed",
            ].join(" ")}
          >
            Check answer
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
  locked,
  revealAnswer,
  onAnswer,
}: {
  question: Question;
  locked: boolean;
  revealAnswer: boolean;
  onAnswer: (val: string) => void;
}) {
  const skipped = question.status === "skipped" || question.status === "timedOut";
  const getBtnClass = (val: string) => {
    const isCorrect = val === question.answer;
    const isSelected = val === question.userAnswer;
    let base =
      "flex-1 h-12 border border-border rounded-md text-base font-sans " +
      "transition-all duration-[150ms] ease-out " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

    if (revealAnswer) {
      if (isCorrect && isSelected) return base + "border-success text-success ";
      if (isCorrect && !isSelected) return base + "border-accent text-accent ";
      if (isSelected && !isCorrect) return base + "border-error text-error ";
      return base + "opacity-40 text-primary ";
    }
    if (locked && isSelected) return base + "border-accent bg-accent/5 text-primary ";
    if (locked) return base + "border-border text-secondary opacity-50 cursor-not-allowed ";
    return base + "text-primary hover:border-accent cursor-pointer ";
  };

  return (
    <div className="flex gap-3">
      {["TRUE", "FALSE"].map((val) => (
        <button
          key={val}
          type="button"
          disabled={locked}
          onClick={() => !locked && onAnswer(val)}
          aria-label={`Answer ${val === "TRUE" ? "True" : "False"}`}
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
  const { state, answerQuestion, nextQuestion, finishQuiz, timeoutQuestion, setRemaining, gotoQuestion, navigate, showToast } = useAppStore();
  const { quiz } = state;
  const question = quiz.questions[quiz.current] ?? null;
  const [timerDisplay, setTimerDisplay] = useState("");
  const [timerWarning, setTimerWarning] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [gearSpin, setGearSpin] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ConfirmAction | null>(null);
  const gearTimerRef = useRef<number | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [aiSettings, setAiSettings] = useState<AILinkSettings>(() => getAILinkSettings());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef<number>(quiz.settings.timerSeconds);
  const prevIndexRef = useRef<number>(quiz.current);
  const draftAnswerRef = useRef<string | string[] | null>(null);
  const unresolvedCount = useMemo(
    () => quiz.questions.filter((item) => item.status !== "answered").length,
    [quiz.questions]
  );

  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    if (navigatorOpen && deltaY > 60) {
      setNavigatorOpen(false);
    } else if (!navigatorOpen && deltaY < -40) {
      setNavigatorOpen(true);
    }
  }, [navigatorOpen]);

  const [sharingQuiz, setSharingQuiz] = useState(false);

  const handleShareQuiz = async () => {
    if (sharingQuiz) return;
    setSharingQuiz(true);
    try {
      const sourceQuestions = quiz.original && quiz.original.length > 0
        ? quiz.original
        : quiz.questions;
      if (!sourceQuestions || sourceQuestions.length === 0) {
        showToast("Error: No questions found to share.");
        setSharingQuiz(false);
        return;
      }

      const { url, cacheHit } = await getShareLinkForQuiz(sourceQuestions, quiz.title);
      await waitForCachedShareLinkAnimation(cacheHit);
      const copied = await copyToClipboard(url);
      if (copied) {
        showToast(cacheHit ? "Cached sharing link copied!" : "Sharing link copied to clipboard!");
      } else {
        showToast("Could not copy link. Try manual selection.");
      }
    } catch (err) {
      console.error("Failed to share quiz:", err);
      showToast("Error generating sharing link.");
    } finally {
      setSharingQuiz(false);
    }
  };

  const updateDraftAnswer = useCallback((response: string | string[]) => {
    draftAnswerRef.current = response;
  }, []);

  const toggleAiSettings = () => {
    setAiSettingsOpen((prev) => !prev);
    // Trigger a transient spin animation on the gear for both open and close
    if (gearTimerRef.current) {
      window.clearTimeout(gearTimerRef.current);
    }
    setGearSpin(true);
    gearTimerRef.current = window.setTimeout(() => {
      setGearSpin(false);
      gearTimerRef.current = null;
    }, 420);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setNavigatorOpen(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (gearTimerRef.current) window.clearTimeout(gearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    draftAnswerRef.current = null;
  }, [question?.id]);

  useEffect(() => {
    setAiSettingsOpen(false);
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
    if (pendingConfirmAction) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      gotoQuestion(Math.max(0, quiz.current - 1));
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const isLastQuestion = quiz.current === quiz.questions.length - 1;
      if (isLastQuestion) {
        if (unresolvedCount > 0) {
          setPendingConfirmAction({ type: "finish" });
          return;
        }
        finishQuiz();
      } else {
        nextQuestion();
      }
      return;
    }
    if (question.status !== "unseen" && question.status !== "skipped") return;
    if (question.type === "MCQ") {
      const map: Record<string, string> = { a: "A", b: "B", c: "C", d: "D" };
      const letter = map[e.key.toLowerCase()];
      if (letter && question.options[letter]) { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion(letter); }
    }
    if (question.type === "TF") {
      if (e.key.toLowerCase() === "t") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("TRUE"); }
      if (e.key.toLowerCase() === "f") { setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds))); answerQuestion("FALSE"); }
    }
  }, [question, quiz.current, quiz.questions.length, unresolvedCount, pendingConfirmAction, answerQuestion, nextQuestion, finishQuiz, gotoQuestion, setRemaining]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!pendingConfirmAction) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusTimer = window.setTimeout(() => {
      confirmCancelRef.current?.focus();
    }, 0);

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingConfirmAction(null);
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = confirmDialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleDialogKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [pendingConfirmAction]);

  const getNavigatorButtonClass = useCallback((index: number) => {
    const item = quiz.questions[index];
    const base =
      "w-8 h-8 rounded-md text-xs font-mono transition-colors duration-[150ms] " +
      "flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ";

    const revealAnswer = quiz.settings.explanationTiming !== "end";
    if (index === quiz.current) return base + "bg-accent text-bg font-bold ";
    if (item?.status === "answered" && !revealAnswer) return base + "bg-accent/10 border border-accent/40 text-primary ";
    if (item?.status === "answered" && item?.isCorrect === true) return base + "bg-success/20 border border-success text-success ";
    if (item?.status === "answered" && item?.isCorrect === false) return base + "bg-error/20 border border-error text-error ";
    if (item?.status === "skipped") return base + "bg-bg border border-border text-secondary ";
    if (item?.status === "timedOut") return base + "bg-border/60 border border-border text-secondary ";
    return base + "bg-bg border border-border text-secondary hover:bg-border ";
  }, [quiz.current, quiz.questions, quiz.settings.explanationTiming]);

  const requestNavigation = useCallback((action: ConfirmAction) => {
    if (action.type === "goto") {
      if (action.index === quiz.current) return;
      gotoQuestion(action.index);
      return;
    }

    if (action.type === "next") {
      nextQuestion();
      return;
    }

    if (unresolvedCount > 0) {
      setPendingConfirmAction(action);
      return;
    }
    finishQuiz();
  }, [finishQuiz, gotoQuestion, nextQuestion, quiz.current, unresolvedCount]);

  const renderNavigatorGrid = useCallback(() => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(2rem,1fr))] gap-2">
      {quiz.questions.map((_, i) => (
        <button
          key={`idx-${i}`}
          type="button"
          onClick={() => {
            requestNavigation({ type: "goto", index: i });
            if (typeof window !== "undefined" && window.innerWidth < 1024) {
              setNavigatorOpen(false);
            }
          }}
          data-tutorial="quiz-nav-jump"
          className={getNavigatorButtonClass(i)}
          aria-label={`Jump to question ${i + 1}`}
          aria-current={i === quiz.current ? "step" : undefined}
        >
          {i + 1}
        </button>
      ))}
    </div>
  ), [getNavigatorButtonClass, quiz.current, quiz.questions, requestNavigation]);

  if (!question) {
    return (
      <div className="max-w-content-sm mx-auto px-4 pt-12 pb-20">
        <section className="rounded-lg border border-border bg-surface p-5 text-center shadow-card sm:p-6">
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-3">
            Quiz unavailable
          </p>
          <h1 className="text-xl font-semibold text-primary">No quiz question found</h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            This can happen if old saved quiz data is incomplete. Paste a quiz to start again.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("home")}
              className="rounded-md border border-border px-4 py-2 text-sm text-secondary transition-colors duration-[150ms] hover:border-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={() => navigate("input")}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity duration-[150ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Paste a quiz
            </button>
          </div>
        </section>
      </div>
    );
  }

  const handleAnswerWrapped = (response: any) => {
    setRemaining(quiz.current, Math.max(0, Math.floor(remainingRef.current ?? quiz.settings.timerSeconds)));
    answerQuestion(response);
  };

  const isEndReviewMode = quiz.settings.explanationTiming === "end";
  const isQuestionAnswered = question.status === "answered";
  const isQuestionSkipped = question.status === "skipped";
  const isQuestionTimedOut = question.status === "timedOut";
  const isQuestionLocked = isQuestionAnswered || isQuestionTimedOut;
  const shouldRevealAnswer = isQuestionAnswered && !isEndReviewMode;
  const answeredCount = useMemo(
    () => quiz.questions.filter((item) => item.status === "answered").length,
    [quiz.questions]
  );

  const progress = useMemo(
    () => (quiz.current / quiz.questions.length) * 100,
    [quiz.current, quiz.questions.length]
  );
  const isLast = quiz.current === quiz.questions.length - 1;
  const showExplanation = shouldRevealAnswer && question.explanation && quiz.settings.explanationTiming === "after";
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
      showToast(`Could not use that saved ${provider === "chatgpt" ? "ChatGPT" : "Claude"} conversation. Opened a new chat instead.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyFollowUpPrompt = async () => {
    const copied = await copyToClipboard(followUpPrompt);
    if (copied) {
      showToast("Prompt copied to clipboard");
      return;
    }
    showToast("Copy failed. Select the text and copy manually.");
  };

  const handleForward = () => {
    if (isLast) {
      requestNavigation({ type: "finish" });
      return;
    }
    requestNavigation({ type: "next" });
  };

  const confirmPendingAction = () => {
    if (!pendingConfirmAction) return;
    const action = pendingConfirmAction;
    setPendingConfirmAction(null);

    if (action.type === "finish") {
      finishQuiz();
      return;
    }

    if (action.type === "goto") {
      gotoQuestion(action.index);
      return;
    }

    nextQuestion();
  };

  const forwardLabel = isLast
    ? isQuestionLocked
      ? "See results"
      : "Finish quiz"
    : isQuestionLocked || isQuestionSkipped
      ? "Next question"
      : "Skip & next";

  const confirmTitle = "Finish with pending questions?";
  const confirmBody = `You have ${unresolvedCount} skipped or unanswered question${unresolvedCount === 1 ? "" : "s"}. Results will count them as skipped.`;
  const confirmLabel = "Finish quiz";

  return (
    <div className="relative">
      <div className="fixed top-[52px] left-0 right-0 h-[3px] bg-border z-[99]" aria-hidden="true">
        <div className="h-full bg-accent smooth-width" style={{ width: `${progress}%` }} />
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
            "absolute top-4 -left-10 h-10 w-10 rounded-l-md border border-r-0 border-border",
            "bg-surface text-secondary shadow-card transition-colors duration-[150ms]",
            "hover:text-primary hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent btn-anim",
          ].join(" ")}
          aria-label={navigatorOpen ? "Collapse question navigator" : "Expand question navigator"}
          aria-expanded={navigatorOpen}
        >
          <svg viewBox="0 0 20 20" fill="none" className={`mx-auto h-4 w-4 transform transition-transform duration-200 ${navigatorOpen ? "rotate-0" : "-rotate-180"}`} aria-hidden="true">
            <path
              d="M8 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
            <div className="mt-4 flex flex-col gap-3 text-sm border-t border-border pt-4">
              <button
                type="button"
                onClick={handleForward}
                className="text-left text-accent hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm font-semibold flex items-center justify-between"
              >
                <span>{forwardLabel}</span>
                <span>→</span>
              </button>
              <button
                type="button"
                disabled={sharingQuiz}
                onClick={handleShareQuiz}
                className="text-left text-secondary hover:text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>{sharingQuiz ? "Generating link..." : "Share quiz"}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className={`max-w-[760px] mx-auto px-3 pt-6 pb-20 sm:px-4 sm:pt-10 ${navigatorOpen ? "pointer-events-none lg:pointer-events-auto" : ""}`}>

        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3 sm:px-7 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-secondary">
                Question {quiz.current + 1} of {quiz.questions.length}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-secondary" aria-live="polite">
                  {isEndReviewMode
                    ? `Answered ${answeredCount} / ${quiz.questions.length}`
                    : `✓ ${quiz.correct}  ✗ ${quiz.wrong}`}
                </span>
                {quiz.settings.timer && timerDisplay && (
                  <span className={`text-sm font-mono min-w-[36px] text-right ${timerWarning ? "text-error pulse-glow" : "text-secondary"}`} aria-label="Time remaining">
                    {timerDisplay}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div key={question.id} className="px-4 py-5 animate-fade-in sm:px-7 sm:py-8">
            {question.fillMode !== "dragdrop" && (
              <p className="text-base font-medium text-primary leading-relaxed mb-5 sm:text-md sm:mb-7">{question.question}</p>
            )}

            {(isQuestionSkipped || isQuestionTimedOut) && (
              <p className="text-sm text-secondary mb-4">
                {isQuestionTimedOut ? "Time is up. This question was skipped." : "Skipped"}
              </p>
            )}

            {question.type === "MCQ" && (
              <MCQOptions question={question} locked={isQuestionLocked} revealAnswer={shouldRevealAnswer} onAnswer={handleAnswerWrapped} />
            )}
            {question.type === "FILL" && (
              question.fillMode === "dragdrop" ? (
                <DragDropFill question={question} locked={isQuestionLocked} revealAnswer={shouldRevealAnswer} onAnswer={handleAnswerWrapped} onDraftChange={updateDraftAnswer} />
              ) : (
                <FillInput question={question} locked={isQuestionLocked} revealAnswer={shouldRevealAnswer} onAnswer={handleAnswerWrapped} onDraftChange={updateDraftAnswer} />
              )
            )}
            {question.type === "TF" && (
              <TFOptions question={question} locked={isQuestionLocked} revealAnswer={shouldRevealAnswer} onAnswer={handleAnswerWrapped} />
            )}
          </div>

          {showExplanation && (
            <div className="border-t border-border px-4 py-5 animate-fade-in sm:px-7" aria-live="polite">
              <div>
                <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-2">Explanation</p>
                <MarkdownRenderer content={question.explanation} className="text-base leading-[1.7]" />
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
                    onClick={toggleAiSettings}
                    className="h-8 w-8 rounded-md border border-border text-secondary hover:text-primary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent flex items-center justify-center btn-anim"
                    aria-expanded={aiSettingsOpen}
                    aria-label={aiSettingsOpen ? "Hide AI settings" : "Change AI settings"}
                  >
                    <Settings className={`w-5 h-5 ${gearSpin ? 'spin-gear' : ''}`} aria-hidden="true" />
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
                              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                              aria-pressed={config.mode === "new"}
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
                              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                              aria-pressed={config.mode === "continue"}
                            >
                              Continue chat
                            </button>
                          </div>
                          <input
                            type="text"
                            disabled={config.mode === "new"}
                            value={config.conversationRef}
                            onChange={(event) => updateProviderSettings(provider, { conversationRef: event.target.value })}
                            placeholder={config.mode === "new" ? "Select continue to paste URL" : "Paste chat URL, shared URL, or ID"}
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

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openProvider("chatgpt")}
                    data-tutorial="quiz-explain-ai"
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Explain in ChatGPT ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => openProvider("claude")}
                    data-tutorial="quiz-explain-ai"
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Explain in Claude ↗
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyFollowUpPrompt}
                    data-tutorial="quiz-explain-ai"
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm text-primary hover:border-secondary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy prompt
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border px-4 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-3 animate-fade-in">
              <button
                type="button"
                onClick={() => requestNavigation({ type: "goto", index: Math.max(0, quiz.current - 1) })}
                disabled={quiz.current === 0}
                className="text-secondary text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm disabled:opacity-40"
              >
                ← Previous
              </button>

              <button
                type="button"
                onClick={handleForward}
                className="text-accent text-base hover:opacity-80 transition-opacity duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              >
                {forwardLabel} →
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Backdrop Overlay for Mobile Drawer */}
      {navigatorOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-45 animate-fade-in"
          onClick={() => setNavigatorOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Swipeable Collapsible Bottom Sheet Drawer */}
      <div
        className={[
          "lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border shadow-card-lg transition-transform duration-300 ease-out flex flex-col max-h-[85vh] select-none",
          navigatorOpen ? "pb-8 h-auto" : "pb-0 h-12 overflow-hidden"
        ].join(" ")}
        style={{
          transform: navigatorOpen ? "translateY(0)" : "translateY(calc(100% - 48px))"
        }}
        role="dialog"
        aria-modal={navigatorOpen ? "true" : "false"}
        aria-label="Question navigation sheet"
      >
        {/* Header / Grab Handle Area (Acts as the trigger bar when collapsed) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={!navigatorOpen ? () => setNavigatorOpen(true) : undefined}
          className={[
            "w-full pt-3 pb-3 px-4 cursor-pointer relative select-none",
            !navigatorOpen ? "h-12 flex items-center justify-between" : "flex items-center justify-between border-b border-border/40"
          ].join(" ")}
        >
          {/* Drag Handle Indicator */}
          <div className="w-12 h-1 bg-border rounded-full absolute top-1.5 left-1/2 -translate-x-1/2" />
          
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-primary">
              {!navigatorOpen ? `Questions (${quiz.current + 1}/${quiz.questions.length})` : "Quiz Navigation"}
            </h2>
            {navigatorOpen && (
              <p className="text-xs text-secondary">
                Question {quiz.current + 1} of {quiz.questions.length}
              </p>
            )}
          </div>

          {/* Right Action / Indicator */}
          <div>
            {!navigatorOpen ? (
              <span className="text-2xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1">
                Swipe up or Tap
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 stroke-current animate-bounce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNavigatorOpen(false);
                }}
                className="p-1.5 rounded-full hover:bg-bg border border-border text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close navigator"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Drawer Content - only scrollable / interactive when expanded */}
        {navigatorOpen && (
          <div className="overflow-y-auto px-4 py-3 flex-grow pr-1">
            {renderNavigatorGrid()}
          </div>
        )}

        {/* Footer with actions - only visible when expanded */}
        {navigatorOpen && (
          <div className="mt-auto px-4 pt-4 pb-8 border-t border-border flex items-center justify-between text-sm bg-surface">
            <button
              type="button"
              disabled={sharingQuiz}
              onClick={handleShareQuiz}
              className="text-secondary hover:text-primary transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm font-medium disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{sharingQuiz ? "Generating link..." : "Share quiz"}</span>
            </button>

            <button
              type="button"
              onClick={handleForward}
              className="text-accent hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm font-semibold flex items-center gap-1"
            >
              <span>{forwardLabel}</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {pendingConfirmAction && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-confirm-title"
          aria-describedby="skip-confirm-body"
        >
          <div ref={confirmDialogRef} className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-card">
            <h2 id="skip-confirm-title" className="text-base font-semibold text-primary">
              {confirmTitle}
            </h2>
            <p id="skip-confirm-body" className="mt-2 text-sm leading-relaxed text-secondary">
              {confirmBody}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                ref={confirmCancelRef}
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                className="rounded-md border border-border px-3.5 py-2 text-sm text-secondary transition-colors duration-[150ms] hover:text-primary hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition-opacity duration-[150ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
