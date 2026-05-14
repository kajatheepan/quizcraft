"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { buildPrompt } from "@/lib/quizEngine";
import Chip from "@/components/ui/Chip";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { buildAIUrl } from "@/lib/aiLinks";
import { getAILinkSettings, saveAILinkSettings } from "@/lib/storage";
import type { AILinkSettings, AIProvider, AIProviderLinkConfig } from "@/types/quiz";

const ALL_TYPES = ["MCQ", "FILL", "TF"] as const;
const TYPE_LABELS: Record<string, string> = { MCQ: "MCQ", FILL: "Fill in Blank", TF: "True/False" };
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Mixed"].map((v) => ({ label: v, value: v }));

export default function PromptView() {
  const { navigateBack, navigate, showToast } = useAppStore();

  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(20);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(["MCQ", "FILL", "TF"]));
  const [difficulty, setDifficulty] = useState("Medium");
  const [focus, setFocus] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy Prompt");
  const [aiSettings, setAiSettings] = useState<AILinkSettings | null>(null);

  const prompt = useMemo(
    () => buildPrompt(subject, count, activeTypes, difficulty, focus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject, count, activeTypes, difficulty, focus]
  );

  useEffect(() => {
    setAiSettings(getAILinkSettings());
  }, []);

  // Slider pill position
  const sliderPct = ((count - 5) / (50 - 5)) * 100;

  const toggleType = (t: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopyLabel("✓ Copied!");
      showToast("Prompt copied to clipboard");
      setTimeout(() => setCopyLabel("Copy Prompt"), 2000);
    }).catch(() => showToast("Copy failed — select the text manually"));
  };

  const updateProviderSettings = (provider: AIProvider, patch: Partial<AIProviderLinkConfig>) => {
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

  const openProvider = (provider: AIProvider) => {
    const settings = aiSettings ?? getAILinkSettings();
    const { url, usedFallback } = buildAIUrl(provider, prompt, settings);
    if (usedFallback) {
      showToast(`Invalid ${provider === "chatgpt" ? "ChatGPT" : "Claude"} chat reference. Opened a new chat.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-content-xl mx-auto px-4 pt-10 pb-20">
      {/* Top bar */}
      <div className="relative flex items-center justify-between mb-9">
        <button
          onClick={() => navigateBack("home")}
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          ← Back
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-2xs font-medium tracking-[0.1em] uppercase text-secondary">
          Generate Prompt
        </p>
        <span />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* LEFT: Form */}
        <div>
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-5">
            Configure
          </p>

          {/* Subject */}
          <div className="mb-6">
            <label htmlFor="prompt-subject" className="block text-sm text-secondary mb-2">
              Subject / Topic
            </label>
            <input
              id="prompt-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Data Link Layer"
              className="w-full h-10 bg-surface border border-border rounded-md px-3 text-sm text-primary
                         placeholder:text-secondary transition-colors duration-[150ms]
                         focus:outline-none focus:border-accent"
            />
          </div>

          {/* Count slider */}
          <div className="mb-6">
            <label className="block text-sm text-secondary mb-2">Number of questions</label>
            <div className="relative pt-7">
              {/* Floating pill */}
              <div
                className="absolute top-0 bg-border text-primary text-xs px-2 py-0.5 rounded-full
                           whitespace-nowrap pointer-events-none -translate-x-1/2"
                style={{ left: `calc(${sliderPct}% + ${8 - sliderPct * 0.16}px)` }}
              >
                {count} questions
              </div>
              <input
                type="range"
                min={5}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                aria-label="Number of questions"
                className="w-full h-[3px] bg-border rounded-full appearance-none outline-none
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                           [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                           [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent
                           [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-secondary mt-1.5">
                <span>5</span><span>50</span>
              </div>
            </div>
          </div>

          {/* Question types */}
          <div className="mb-6">
            <label className="block text-sm text-secondary mb-2">Question types</label>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Question types">
              {ALL_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={TYPE_LABELS[t]}
                  active={activeTypes.has(t)}
                  onClick={() => toggleType(t)}
                />
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-6">
            <label className="block text-sm text-secondary mb-2">Difficulty</label>
            <SegmentedControl
              ariaLabel="Difficulty level"
              options={DIFFICULTY_OPTIONS}
              value={difficulty}
              onChange={setDifficulty}
            />
          </div>

          {/* Focus area */}
          <div className="mb-6">
            <label htmlFor="prompt-focus" className="block text-sm text-secondary mb-2">
              Focus area{" "}
              <span className="text-secondary opacity-60">(optional)</span>
            </label>
            <textarea
              id="prompt-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Specific topics to emphasize..."
              rows={3}
              className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-primary
                         placeholder:text-secondary resize-none transition-colors duration-[150ms]
                         focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div>
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-4">
            Prompt Preview
          </p>

          {/* Code preview */}
          <div
            aria-label="Generated prompt preview"
            aria-live="polite"
            className="bg-bg border border-border rounded-lg p-4 min-h-[400px] max-h-[500px]
                       overflow-y-auto font-mono text-[12px] text-[#A0A0A0] leading-[1.7]
                       whitespace-pre-wrap"
          >
            {prompt}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            data-tutorial="prompt-copy"
            className="mt-4 w-full py-[11px] px-5 bg-accent text-white rounded-lg
                       text-base font-medium shadow-card text-center
                       hover:opacity-90 active:scale-[0.99]
                       transition-all duration-[150ms] ease-out
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {copyLabel}
          </button>

          {/* Links */}
          <div className="text-center mt-3.5 text-sm">
            <button
              onClick={() => openProvider("chatgpt")}
              data-tutorial="prompt-open-ai"
              className="text-secondary hover:text-primary transition-colors duration-[150ms]"
            >
              Open ChatGPT ↗
            </button>
            <span className="text-secondary mx-2">·</span>
            <button
              onClick={() => openProvider("claude")}
              data-tutorial="prompt-open-ai"
              className="text-secondary hover:text-primary transition-colors duration-[150ms]"
            >
              Open Claude ↗
            </button>
          </div>

          {/* AI link settings */}
          <div className="mt-5 border border-border rounded-lg p-4">
            <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-3">
              AI Link Settings
            </p>

            {(["chatgpt", "claude"] as AIProvider[]).map((provider) => {
              const label = provider === "chatgpt" ? "ChatGPT" : "Claude";
              const config = (aiSettings ?? getAILinkSettings())[provider];
              return (
                <div key={provider} className="mb-4 last:mb-0">
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
                    value={config.conversationRef}
                    onChange={(e) => updateProviderSettings(provider, { conversationRef: e.target.value })}
                    placeholder={provider === "chatgpt" ? "Chat URL or conversation ID" : "Claude chat URL or ID"}
                    className="w-full h-10 bg-surface border border-border rounded-md px-3 text-sm text-primary
                               placeholder:text-secondary transition-colors duration-[150ms]
                               focus:outline-none focus:border-accent"
                  />
                  <p className="text-xs text-secondary mt-1.5">
                    Used only in Continue chat mode. If invalid, it falls back to a new chat.
                  </p>
                </div>
              );
            })}
          </div>

          {/* Instruction */}
          <p className="text-center text-sm text-secondary mt-3">
            Copy prompt → paste in AI → paste output below
            <br />
            <button
              onClick={() => navigate("input")}
              data-tutorial="prompt-paste-quiz"
              className="text-accent hover:underline mt-0.5 inline-block"
            >
              Paste my quiz →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
