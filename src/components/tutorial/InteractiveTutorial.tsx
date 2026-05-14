"use client";

// Onboarding is a true modal. Coach marks are non-modal hints so users can
// click the highlighted app controls directly.

import { useEffect, useMemo, useRef, useState } from "react";
import { getTutorialSeen, saveTutorialSeen } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";
import type { ViewName } from "@/types/quiz";

type TutorialMode = "onboarding" | "coach";
type StepAction = "info" | "click";
type StepPlacement = "center" | "top" | "right" | "bottom" | "left";

interface CoachStep {
  id: string;
  view: ViewName;
  title: string;
  body: string;
  action: StepAction;
  selectors: string[];
  placement?: StepPlacement;
}

const COACH_STEPS: CoachStep[] = [
  {
    id: "open-prompt",
    view: "home",
    title: "Create a quiz with AI",
    body: "Start here when you do not already have quiz JSON. QuizCraft gives you a prompt made for ChatGPT or Claude.",
    action: "click",
    selectors: ['[data-tutorial="nav-prompt"]'],
    placement: "bottom",
  },
  {
    id: "copy-prompt",
    view: "prompt",
    title: "Copy the AI-ready prompt",
    body: "This prompt asks the AI to return quiz JSON in the format QuizCraft can read.",
    action: "click",
    selectors: ['[data-tutorial="prompt-copy"]'],
    placement: "left",
  },
  {
    id: "open-ai",
    view: "prompt",
    title: "Generate it in ChatGPT or Claude",
    body: "Open your preferred AI tool, paste the prompt, and let it generate the quiz. These links are helpers; you can also paste manually.",
    action: "info",
    selectors: ['[data-tutorial="prompt-open-ai"]'],
    placement: "top",
  },
  {
    id: "paste-quiz",
    view: "prompt",
    title: "Come back with the result",
    body: "After the AI returns JSON, come back to QuizCraft and paste it to start practicing.",
    action: "click",
    selectors: ['[data-tutorial="prompt-paste-quiz"]'],
    placement: "top",
  },
  {
    id: "ai-settings",
    view: "input",
    title: "Optional: choose how AI chats open",
    body: "Use AI Chat Settings if you want explanations to start a new chat or continue in a specific ChatGPT/Claude conversation.",
    action: "info",
    selectors: ['[data-tutorial="input-ai-settings-toggle"]'],
    placement: "bottom",
  },
];

const CONTEXTUAL_STEPS: Partial<Record<ViewName, CoachStep[]>> = {
  quiz: [
    {
      id: "quiz-explain-ai",
      view: "quiz",
      title: "Ask AI about difficult questions",
      body: "After answering, send this question to ChatGPT or Claude to understand the mistake in simple steps.",
      action: "info",
      selectors: ['[data-tutorial="quiz-explain-ai"]'],
      placement: "top",
    },
  ],
  results: [
    {
      id: "results-explain-ai",
      view: "results",
      title: "Review mistakes with AI",
      body: "Open or copy a focused prompt for any review item when you want a clearer explanation.",
      action: "info",
      selectors: ['[data-tutorial="results-explain-ai"]'],
      placement: "top",
    },
  ],
};

function getTarget(step: CoachStep): HTMLElement | null {
  for (const selector of step.selectors) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function InteractiveTutorial({ currentView }: { currentView: ViewName }) {
  const { navigate } = useAppStore();
  const [mode, setMode] = useState<TutorialMode | null>(null);
  const [coachSteps, setCoachSteps] = useState<CoachStep[]>(COACH_STEPS);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const onboardingDialogRef = useRef<HTMLDivElement>(null);
  const onboardingPrimaryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const step = mode === "coach" ? coachSteps[stepIndex] : null;

  const cardStyle = useMemo(() => {
    const width = 330;

    if (!targetRect || (step?.placement ?? "center") === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width,
      } as const;
    }

    const placement = step?.placement ?? "bottom";
    const margin = 12;

    let top = targetRect.bottom + margin;
    let left = clamp(targetRect.left, 12, window.innerWidth - width - 12);

    if (placement === "top") {
      top = targetRect.top - 180;
      left = clamp(targetRect.left, 12, window.innerWidth - width - 12);
    } else if (placement === "right") {
      top = clamp(targetRect.top, 70, window.innerHeight - 200);
      left = targetRect.right + margin;
      if (left + width > window.innerWidth - 12) {
        left = clamp(targetRect.left - width - margin, 12, window.innerWidth - width - 12);
      }
    } else if (placement === "left") {
      top = clamp(targetRect.top, 70, window.innerHeight - 200);
      left = targetRect.left - width - margin;
      if (left < 12) {
        left = clamp(targetRect.right + margin, 12, window.innerWidth - width - 12);
      }
    }

    top = clamp(top, 70, window.innerHeight - 220);

    return {
      top,
      left,
      width,
    } as const;
  }, [step?.placement, targetRect]);

  const closeTutorial = (markSeen: boolean) => {
    if (markSeen) saveTutorialSeen(true);
    setMode(null);
    setStepIndex(0);
    setTargetRect(null);
  };

  const startCoach = (steps = COACH_STEPS, index = 0) => {
    setCoachSteps(steps);
    setStepIndex(index);
    setTargetRect(null);
    setMode("coach");
  };

  const startContextualCoach = (view: ViewName) => {
    const contextual = CONTEXTUAL_STEPS[view];
    startCoach(contextual && contextual.length > 0 ? contextual : COACH_STEPS, 0);
  };

  const nextStep = () => {
    if (mode !== "coach") return;
    if (stepIndex >= coachSteps.length - 1) {
      closeTutorial(true);
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const prevStep = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const startWithPrompt = () => {
    saveTutorialSeen(true);
    navigate("prompt");
    startCoach(COACH_STEPS, 1);
  };

  const pasteDirectly = () => {
    saveTutorialSeen(true);
    navigate("input");
    closeTutorial(false);
  };

  useEffect(() => {
    if (!getTutorialSeen()) {
      setMode("onboarding");
      setStepIndex(0);
    }

    const onStart = () => {
      startContextualCoach(currentView);
    };

    window.addEventListener("start-interactive-tutorial", onStart);
    return () => window.removeEventListener("start-interactive-tutorial", onStart);
  }, [currentView]);

  useEffect(() => {
    if (mode !== "coach" || !step) return;

    const refreshTarget = () => {
      const target = getTarget(step);
      setTargetRect(target ? target.getBoundingClientRect() : null);
    };

    refreshTarget();
    window.addEventListener("resize", refreshTarget);
    window.addEventListener("scroll", refreshTarget, true);

    const interval = window.setInterval(refreshTarget, 250);
    return () => {
      window.removeEventListener("resize", refreshTarget);
      window.removeEventListener("scroll", refreshTarget, true);
      window.clearInterval(interval);
    };
  }, [mode, stepIndex, step]);

  useEffect(() => {
    if (mode !== "onboarding") return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusTimer = window.setTimeout(() => {
      onboardingPrimaryRef.current?.focus();
    }, 0);

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTutorial(true);
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = onboardingDialogRef.current;
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
  }, [mode]);

  useEffect(() => {
    if (mode !== "coach" || !step || step.action !== "click") return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const matched = step.selectors.some((selector) => target.closest(selector));
      if (matched) {
        window.setTimeout(() => nextStep(), 120);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [mode, stepIndex, step]);

  if (mode === "onboarding") {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-4">
        <div
          ref={onboardingDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-body"
          className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <p className="mb-2 text-2xs font-medium uppercase tracking-[0.1em] text-accent">
            Welcome
          </p>
          <h2 id="onboarding-title" className="text-xl font-semibold text-primary">
            Learn with AI-generated quizzes
          </h2>
          <p id="onboarding-body" className="mt-3 text-sm leading-relaxed text-secondary">
            Generate a quiz prompt, use ChatGPT or Claude to create the quiz JSON, paste it back here, practice interactively, then review difficult answers with AI.
          </p>

          <div className="mt-5 rounded-md border border-border bg-bg px-3 py-3">
            <ol className="space-y-2 text-sm text-primary/90">
              <li>1. Generate an AI prompt</li>
              <li>2. Create the quiz in ChatGPT or Claude</li>
              <li>3. Paste the result into QuizCraft</li>
              <li>4. Practice and review mistakes with AI</li>
            </ol>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              ref={onboardingPrimaryRef}
              type="button"
              onClick={startWithPrompt}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-[150ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Start with AI prompt
            </button>
            <button
              type="button"
              onClick={pasteDirectly}
              className="rounded-md border border-border px-4 py-2.5 text-sm text-primary transition-colors duration-[150ms] hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Paste quiz directly
            </button>
            <button
              type="button"
              onClick={() => closeTutorial(true)}
              className="rounded-md px-4 py-2.5 text-sm text-secondary transition-colors duration-[150ms] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode !== "coach" || !step) return null;

  const targetMissing = !targetRect || currentView !== step.view;

  return (
    <div className="fixed inset-0 z-[130] pointer-events-none">
      {targetRect && currentView === step.view && (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-accent/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div
        className="fixed pointer-events-auto rounded-lg border border-border bg-surface p-4 shadow-card"
        style={cardStyle}
        role="note"
        aria-live="polite"
      >
        <p className="mb-1 text-2xs font-medium uppercase tracking-[0.1em] text-accent">
          QuizCraft workflow
        </p>
        <h3 className="mb-2 text-base font-semibold text-primary">{step.title}</h3>
        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-secondary">{step.body}</p>

        {targetMissing && (
          <p className="mb-4 text-xs text-secondary">
            Go to the {step.view} section to see this feature.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => closeTutorial(true)}
            className="rounded-sm text-xs text-secondary transition-colors duration-[150ms] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Done
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-secondary transition-colors duration-[150ms] hover:text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-primary transition-colors duration-[150ms] hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {step.action === "click" ? "Skip step" : stepIndex >= coachSteps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
