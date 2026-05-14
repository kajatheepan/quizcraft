import type { ViewName } from "@/types/quiz";
import { getTutorialSeen, saveTutorialSeen } from "@/lib/storage";

export type TutorialPlacement = "top" | "bottom" | "left" | "right";

export interface TutorialStep {
  id: string;
  view: ViewName;
  selector: string;
  section: string;
  title: string;
  body: string;
  placement?: TutorialPlacement;
  advanceOnClick?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    view: "home",
    selector: "[data-tutorial=home-hero]",
    section: "Welcome",
    title: "Your Quiz Lab for Fast Revision",
    body:
      "This app helps you practice quizzes generated in ChatGPT or Claude.\nIf you need a prompt first, use Get AI Prompt in the navbar.",
    placement: "bottom",
    advanceOnClick: false,
  },
  {
    id: "paste-quiz",
    view: "home",
    selector: "[data-tutorial=home-paste]",
    section: "Create Quiz",
    title: "Paste your quiz JSON",
    body:
      "Click Paste a Quiz to open the input screen.\nThis is where you paste the quiz output you got from your AI assistant.",
    placement: "bottom",
    advanceOnClick: true,
  },
  {
    id: "demo-quiz",
    view: "input",
    selector: "[data-tutorial=input-demo]",
    section: "Demo",
    title: "Start with a demo quiz",
    body:
      "Click Load a demo quiz first so you can test the full experience immediately.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "settings-open",
    view: "input",
    selector: "[data-tutorial=input-settings-toggle]",
    section: "Settings",
    title: "Open quiz settings",
    body:
      "Click Settings to open the quiz options panel.\nTry to keep an eye on Shuffle questions and Timer as you use the app.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "settings-shuffle",
    view: "input",
    selector: "#toggle-shuffle",
    section: "Settings",
    title: "Try shuffle questions",
    body:
      "Click the Shuffle questions toggle once.\nThis changes the order of questions in the quiz.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "settings-timer",
    view: "input",
    selector: "#toggle-timer",
    section: "Settings",
    title: "Turn the timer on or off",
    body:
      "Click Timer per question once.\nWhen enabled, the quiz will save and resume remaining time per question.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "ai-settings-open",
    view: "input",
    selector: "[data-tutorial=input-ai-settings-toggle]",
    section: "AI Chat Settings",
    title: "Open AI Chat Settings",
    body:
      "Click AI Chat Settings to open the custom Open with AI section.\nThis controls how explanation links open in ChatGPT and Claude.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "ai-settings-continue",
    view: "input",
    selector: "[data-tutorial=input-ai-continue-chatgpt]",
    section: "AI Chat Settings",
    title: "Choose Continue chat",
    body:
      "Click Continue chat for ChatGPT or Claude.\nIf you already have a conversation, paste the chat URL or ID below.",
    placement: "right",
    advanceOnClick: true,
  },
  {
    id: "start-quiz",
    view: "input",
    selector: "[data-tutorial=input-start]",
    section: "Start Quiz",
    title: "Start the quiz",
    body:
      "When the quiz looks ready, click Start Quiz to begin interactive practice.",
    placement: "top",
    advanceOnClick: true,
  },
  {
    id: "quiz-navigation",
    view: "quiz",
    selector: "[data-tutorial=quiz-navigation]",
    section: "Quiz Navigation",
    title: "Move around the quiz",
    body:
      "Use the number buttons to jump between questions.\nThis helps you revisit anything you want to review again.",
    placement: "left",
    advanceOnClick: true,
  },
  {
    id: "quiz-answer",
    view: "quiz",
    selector: "[data-tutorial=quiz-answer-options]",
    section: "Answer Practice",
    title: "Pick any answer",
    body:
      "Select one answer on the question card.\nThe app will check it instantly and store your progress.",
    placement: "top",
    advanceOnClick: true,
  },
  {
    id: "quiz-explanation",
    view: "quiz",
    selector: "[data-tutorial=quiz-explain-actions]",
    section: "AI Explanation",
    title: "Open the explanation in AI",
    body:
      "Use Explain in ChatGPT or Explain in Claude to open the explanation in your AI assistant.",
    placement: "top",
    advanceOnClick: true,
  },
];

type TutorialListener = (state: TutorialState) => void;

export interface TutorialState {
  open: boolean;
  stepIndex: number;
}

let tutorialState: TutorialState = {
  open: false,
  stepIndex: 0,
};

const listeners = new Set<TutorialListener>();

function clampStepIndex(index: number): number {
  return Math.max(0, Math.min(index, TUTORIAL_STEPS.length - 1));
}

function emit() {
  listeners.forEach((listener) => listener(tutorialState));
}

export function getTutorialState(): TutorialState {
  return tutorialState;
}

export function subscribeTutorial(listener: TutorialListener): () => void {
  listeners.add(listener);
  listener(tutorialState);
  return () => {
    listeners.delete(listener);
  };
}

export function openTutorial(stepIndex = 0): void {
  tutorialState = {
    open: true,
    stepIndex: clampStepIndex(stepIndex),
  };
  emit();
}

export function closeTutorial(markSeen = true): void {
  if (markSeen) {
    saveTutorialSeen(true);
  }
  tutorialState = {
    ...tutorialState,
    open: false,
  };
  emit();
}

export function nextTutorialStep(): void {
  if (tutorialState.stepIndex >= TUTORIAL_STEPS.length - 1) {
    closeTutorial(true);
    return;
  }
  tutorialState = {
    ...tutorialState,
    stepIndex: tutorialState.stepIndex + 1,
  };
  emit();
}

export function previousTutorialStep(): void {
  tutorialState = {
    ...tutorialState,
    stepIndex: clampStepIndex(tutorialState.stepIndex - 1),
  };
  emit();
}

export function restartTutorial(): void {
  openTutorial(0);
}

export function shouldAutoOpenTutorial(): boolean {
  return !getTutorialSeen();
}
