"use client";

// First-run onboarding modal. This replaces the older step-by-step coach
// tutorial because the app only needs to explain the AI quiz workflow once.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAppStore } from "@/store/useAppStore";

const ONBOARDING_KEY = "quizcraft_onboarding_seen";

function getOnboardingSeen(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "true";
}

function saveOnboardingSeen(): void {
  window.localStorage.setItem(ONBOARDING_KEY, "true");
}

export default function InteractiveTutorial() {
  const { navigate } = useAppStore();
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeModal = (persist = dontShowAgain) => {
    if (persist) saveOnboardingSeen();
    setOpen(false);
  };

  const goTo = (view: "input" | "prompt") => {
    saveOnboardingSeen();
    setOpen(false);
    navigate(view);
  };

  useEffect(() => {
    if (!getOnboardingSeen()) {
      setOpen(true);
    }

    const onStart = () => {
      setDontShowAgain(false);
      setOpen(true);
    };

    window.addEventListener("start-interactive-tutorial", onStart);
    return () => window.removeEventListener("start-interactive-tutorial", onStart);
  }, []);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusTimer = window.setTimeout(() => {
      primaryRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open, dontShowAgain]);

  if (!open) return null;

  const steps = [
    {
      title: "Generate quiz using AI",
      body: "Ask ChatGPT or Claude to create questions from your notes, slides, or study material.",
    },
    {
      title: "Paste it here",
      body: "Drop the generated questions into QuizCraft Plus. No login or complicated setup.",
    },
    {
      title: "Practice immediately",
      body: "Answer, check feedback, and review mistakes while the topic is still fresh.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 py-6 animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="relative w-[min(920px,92vw)] max-h-[88vh] overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-card animate-fade-in sm:p-7"
      >
        <button
          type="button"
          onClick={() => closeModal()}
          aria-label="Close onboarding"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md border border-border text-secondary transition-colors duration-[150ms] hover:border-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="max-w-3xl pr-10">
          <div className="mb-4 flex items-center gap-3">
            <Image
              src="/logo.webp"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg"
              aria-hidden="true"
            />
            <p className="text-2xs font-medium uppercase tracking-[0.1em] text-accent">
              Fast quiz practice
            </p>
          </div>
          <h2 id="onboarding-title" className="text-2xl font-semibold leading-tight text-primary sm:text-3xl">
            Welcome to QuizCraft Plus
          </h2>
          <p id="onboarding-description" className="mt-3 text-base leading-relaxed text-primary/90">
            Already have questions from ChatGPT, Claude, or your notes? Paste them here and start practicing instantly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["No login", "No setup", "Paste quiz -> practice instantly"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-lg border border-border bg-bg px-4 py-4">
              <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <h3 className="text-sm font-semibold text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-lg border border-border bg-bg px-4 py-4">
            <p className="text-2xs font-medium uppercase tracking-[0.1em] text-secondary">
              Example question format
            </p>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-primary/85">
{`1. What is photosynthesis?
A. Process of making food using sunlight
B. Process of breathing
C. Process of digestion
D. Process of movement
Answer: A`}
            </pre>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-bg px-4 py-4">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.1em] text-secondary">
                Ready to start?
              </p>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                If you already have questions, paste them now. If not, generate a clean AI prompt first.
              </p>
            </div>

            <label className="mt-5 flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--color-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              Don&apos;t show this again
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            ref={primaryRef}
            type="button"
            onClick={() => goTo("input")}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-[150ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Paste a Quiz
          </button>
          <button
            type="button"
            onClick={() => goTo("prompt")}
            className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors duration-[150ms] hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Generate Quiz with AI
          </button>
          <button
            type="button"
            onClick={() => closeModal()}
            className="rounded-md px-4 py-2.5 text-sm text-secondary transition-colors duration-[150ms] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
