"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { parseQuiz } from "@/lib/parser";
import { copyToClipboard } from "@/lib/clipboard";
import { getShareLinkForQuiz, waitForCachedShareLinkAnimation } from "@/lib/shareLinks";
import {
  clearLastQuizText,
  getLastQuizText,
  getPreferences,
  saveLastQuizText,
  savePreferences,
  getAILinkSettings,
  saveAILinkSettings,
} from "@/lib/storage";
import { DEMO_QUIZ, DEFAULT_SETTINGS } from "@/lib/constants";
import Toggle from "@/components/ui/Toggle";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Share2 } from "lucide-react";
import type { QuizSettings, AILinkSettings, AIProvider } from "@/types/quiz";

export default function InputView() {
  const { navigateBack, startQuiz, showToast } = useAppStore();

  const [rawText, setRawText] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
  const [aiSettings, setAiSettings] = useState<AILinkSettings | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const validate = useCallback((val: string) => {
    if (!val.trim()) {
      setIsValid(null);
      setStatusMsg("");
      setQuestionCount(0);
      return;
    }
    const { questions, errors } = parseQuiz(val);
    if (questions.length > 0 && errors.length === 0) {
      setIsValid(true);
      setStatusMsg("Format looks good");
      setQuestionCount(questions.length);
    } else if (errors.length > 0) {
      setIsValid(false);
      setStatusMsg(errors[0]);
      setQuestionCount(0);
    } else {
      setIsValid(null);
      setStatusMsg("");
      setQuestionCount(0);
    }
  }, []);

  // Load saved state on mount
  useEffect(() => {
    const saved = getLastQuizText();
    const prefs = getPreferences();
    if (saved) {
      setRawText(saved);
      validate(saved);
    }
    setSettings((s) => ({ ...s, ...prefs }));
    setAiSettings(getAILinkSettings());

    // Try to auto-paste from clipboard if it contains a new valid quiz
    const tryAutopaste = async () => {
      try {
        if (!navigator?.clipboard?.readText) return;
        // Don't auto-paste if the user is currently editing the textarea
        if (document.activeElement === textareaRef.current) return;

        const clipText = await navigator.clipboard.readText();
        if (!clipText || !clipText.trim()) return;

        // Skip if same as current textarea value
        const currentVal = textareaRef.current?.value ?? "";
        if (clipText.trim() === currentVal.trim()) return;

        const { questions, errors } = parseQuiz(clipText);
        if (questions.length > 0 && errors.length === 0) {
          setRawText(clipText);
          saveLastQuizText(clipText);
          validate(clipText);
          showToast("Autopasted valid quiz from clipboard!");
        }
      } catch (err) {
        // Clipboard access denied or not supported by browser, ignore silently
        console.warn("Clipboard auto-paste not allowed or supported by browser:", err);
      }
    };

    // Check clipboard on mount after page load
    const timeoutId = setTimeout(tryAutopaste, 200);

    // Also check on window focus
    const focusListener = () => {
      tryAutopaste();
    };
    window.addEventListener("focus", focusListener);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("focus", focusListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate, showToast]);

  const handleTextChange = (val: string) => {
    setRawText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveLastQuizText(val);
      validate(val);
    }, 300);
  };

  const updateSetting = <K extends keyof QuizSettings>(key: K, val: QuizSettings[K]) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    savePreferences(next);
  };

  const updateProviderSettings = (provider: AIProvider, patch: any) => {
    setAiSettings((prev) => {
      const base = prev ?? getAILinkSettings();
      const next: AILinkSettings = {
        ...base,
        [provider]: {
          ...base[provider],
          ...patch,
        },
      };
      saveAILinkSettings({ [provider]: next[provider] });
      return next;
    });
  };

  const handleStart = () => {
    if (!isValid) return;
    const { title, questions } = parseQuiz(rawText);
    if (questions.length === 0) return;
    startQuiz(questions, settings, title);
  };

  const handleLoadDemo = () => {
    setRawText(DEMO_QUIZ);
    saveLastQuizText(DEMO_QUIZ);
    validate(DEMO_QUIZ);
    showToast("Demo quiz loaded");
  };

  const handleClearPastedQuiz = () => {
    if (!window.confirm("Clear the pasted quiz text?")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRawText("");
    setIsValid(null);
    setStatusMsg("");
    setQuestionCount(0);
    clearLastQuizText();
    showToast("Pasted quiz cleared");
  };

  const [sharing, setSharing] = useState(false);

  const handleShareQuiz = async () => {
    if (!isValid || sharing) return;
    setSharing(true);
    try {
      const { title, questions } = parseQuiz(rawText);
      if (questions.length === 0) {
        showToast("Error: No questions found to share.");
        setSharing(false);
        return;
      }

      const { url, cacheHit } = await getShareLinkForQuiz(questions, title);
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
      setSharing(false);
    }
  };

  const borderClass =
    isValid === true ? "border-success" :
    isValid === false ? "border-error" :
    "border-border focus:border-accent";

  return (
    <div className="max-w-content-lg mx-auto px-4 pt-10 pb-20">
      {/* Top bar */}
      <div className="relative flex items-center justify-between mb-9">
        <button
          type="button"
          onClick={() => navigateBack("home")}
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          ← Back
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-2xs font-medium tracking-[0.1em] uppercase text-secondary">
          Paste JSON Quiz
        </p>
        <span />
      </div>

      {/* Textarea section */}
      <div>
        {/* Label row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-sm text-secondary">Your quiz</span>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {rawText.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearPastedQuiz}
                className="rounded-sm text-xs text-secondary transition-colors duration-[150ms] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear pasted quiz
              </button>
            )}
            {isValid && questionCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-success" aria-live="polite">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                ✓ {questionCount} question{questionCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          aria-label="Paste your quiz text here"
          className={`
            w-full min-h-[280px] bg-surface border rounded-lg sm:min-h-[360px]
            font-mono text-[13px] text-primary p-4 resize-y
            placeholder:text-secondary leading-relaxed
            transition-colors duration-[250ms] ease-out
            focus:outline-none
            ${borderClass}
          `}
          placeholder={`{\n+  "questions": [\n+    {\n+      "id": 1,\n+      "type": "MCQ",\n+      "question": "What is the capital of France?",\n+      "options": { "A": "London", "B": "Paris", "C": "Berlin", "D": "Rome" },\n+      "answer": "B",\n+      "explanation": "Paris is the capital and most populous city of France."\n+    },\n+    {\n+      "id": 2,\n+      "type": "FILL",\n+      "fillMode": "typed",\n+      "question": "The Data Link Layer is Layer ___ of the OSI model.",\n+      "answer": "2",\n+      "acceptedAnswers": ["2", "two"],\n+      "explanation": "Layer 2 is the Data Link Layer."\n+    },\n+    {\n+      "id": 3,\n+      "type": "FILL",\n+      "fillMode": "dragdrop",\n+      "question": "The [[1]] algorithm helps reduce repeated collisions.",\n+      "blanks": [ { "id": "1", "answer": "backoff" } ],\n+      "choices": ["backoff", "frame", "signal"],\n+      "explanation": "Binary exponential backoff reduces collision retries."\n+    }\n+  ]\n+}`}
        />

        {/* Status */}
        <p
          className={`text-xs text-right mt-1.5 min-h-[18px] transition-colors duration-[150ms]
            ${isValid === true ? "text-success" : isValid === false ? "text-error" : "text-secondary"}`}
          aria-live="polite"
        >
          {statusMsg}
        </p>
      </div>

      {/* Settings */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          data-tutorial="input-settings-toggle"
          aria-expanded={settingsOpen}
          className="flex items-center justify-between w-full py-1 focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <span className="text-sm font-medium text-primary">Settings</span>
          <span
            className={`text-xs text-secondary transition-transform duration-[250ms] ease-out
                        ${settingsOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-[250ms] ease-out
                      ${settingsOpen ? "max-h-[400px]" : "max-h-0"}`}
        >
          <div className="pt-5 flex flex-col gap-5">
            {/* Shuffle questions */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary">Shuffle questions</span>
              <Toggle
                id="toggle-shuffle"
                checked={settings.shuffle}
                onChange={(v) => updateSetting("shuffle", v)}
                label="Shuffle questions"
              />
            </div>

            {/* Shuffle options */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary">Shuffle answer options</span>
              <Toggle
                id="toggle-shuffle-opts"
                checked={settings.shuffleOptions}
                onChange={(v) => updateSetting("shuffleOptions", v)}
                label="Shuffle answer options"
              />
            </div>

            {/* Explanation timing */}
            <div>
              <p className="text-sm text-primary mb-2">Explanation timing</p>
              <SegmentedControl
                ariaLabel="Explanation timing"
                value={settings.explanationTiming}
                onChange={(v) => updateSetting("explanationTiming", v as "after" | "end")}
                options={[
                  { label: "After each question", value: "after" },
                  { label: "At end only", value: "end" },
                ]}
              />
            </div>

            {/* Timer */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary flex-1">Timer per question</span>
              <Toggle
                id="toggle-timer"
                checked={settings.timer}
                onChange={(v) => updateSetting("timer", v)}
                label="Enable timer per question"
              />
              {settings.timer && (
                <input
                  type="number"
                  value={settings.timerSeconds}
                  min={5}
                  max={300}
                  onChange={(e) => updateSetting("timerSeconds", parseInt(e.target.value) || 30)}
                  aria-label="Seconds per question"
                  className="w-16 bg-bg border border-border rounded-md text-primary text-sm
                             px-2.5 py-1.5 focus:outline-none focus:border-accent"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Link Settings */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setAiSettingsOpen((v) => !v)}
          data-tutorial="input-ai-settings-toggle"
          aria-expanded={aiSettingsOpen}
          className="flex items-center justify-between w-full py-1 focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <span className="text-sm font-medium text-primary">AI Chat Settings</span>
          <span
            className={`text-xs text-secondary transition-transform duration-[250ms] ease-out
                        ${aiSettingsOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-[250ms] ease-out
                      ${aiSettingsOpen ? "max-h-[600px]" : "max-h-0"}`}
        >
          <div className="pt-5 flex flex-col gap-5 bg-surface border border-border rounded-md p-4 mt-2">
            <p className="text-xs text-secondary">
              Configure how explanation links open in ChatGPT and Claude. When you select "Continue chat" the explanation will open in the same conversation and continue where you left off; select "New chat" to always start a fresh conversation.
            </p>
            {(["chatgpt", "claude"] as AIProvider[]).map((provider) => {
              const label = provider === "chatgpt" ? "ChatGPT" : "Claude";
              const config = (aiSettings ?? getAILinkSettings())[provider];
              return (
                <div key={provider}>
                  <p className="text-sm text-primary mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
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
                    onChange={(e) => updateProviderSettings(provider, { conversationRef: e.target.value })}
                    placeholder={config.mode === "new" ? "Select 'Continue chat' to paste URL" : "Paste chat URL, shared URL, or ID"}
                    className={`w-full h-9 rounded-md px-3 text-sm transition-colors duration-[150ms]
                               focus:outline-none
                               ${
                                 config.mode === "new"
                                   ? "bg-surface border border-border text-secondary placeholder:text-secondary/50 cursor-not-allowed opacity-50"
                                   : "bg-bg border border-border text-primary placeholder:text-secondary focus:border-accent"
                               }`}
                  />
                  <p className="text-xs text-secondary mt-1">
                    Used only when "Continue chat" is selected — the explanation opens in the specified conversation and continues where you left off. If the conversation reference is invalid, the app will open a new chat instead.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-7 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleStart}
          data-tutorial="input-start-quiz"
          disabled={!isValid}
          className={`
            flex-1 py-3.5 px-5 bg-accent text-white rounded-lg
            text-base font-medium shadow-card text-center
            transition-all duration-[150ms] ease-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
            ${isValid ? "hover:opacity-90 active:scale-[0.99] cursor-pointer" : "opacity-30 cursor-not-allowed"}
          `}
        >
          Start Quiz →
        </button>

        <button
          type="button"
          onClick={handleShareQuiz}
          disabled={!isValid || sharing}
          className={`
            py-3.5 px-5 rounded-lg border border-border text-primary font-medium
            text-base text-center transition-all duration-[150ms] ease-out flex items-center justify-center gap-2
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
            ${isValid ? "bg-surface hover:bg-bg/50 active:scale-[0.99] cursor-pointer" : "opacity-30 cursor-not-allowed"}
          `}
        >
          {sharing ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <span>Generating link...</span>
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span>Share Quiz</span>
            </>
          )}
        </button>
      </div>

      {/* Demo link */}
      <div className="text-center mt-3.5">
        <button
          type="button"
          onClick={handleLoadDemo}
          data-tutorial="input-load-demo"
          className="rounded-sm text-secondary text-sm hover:text-primary transition-colors duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Load a demo quiz
        </button>
      </div>
    </div>
  );
}
