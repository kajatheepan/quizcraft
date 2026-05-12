"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getHistory } from "@/lib/storage";
import type { HistoryEntry } from "@/types/quiz";

export default function HomeView() {
  const { navigate } = useAppStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory().slice(0, 3));
  }, []);

  return (
    <div className="flex flex-col justify-center min-h-[calc(100vh-52px)] max-w-content-sm mx-auto px-4 py-0">
      {/* Label */}
      <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-4">
        Study Smarter
      </p>

      {/* Heading */}
      <h1 className="text-[2.5rem] font-semibold text-primary leading-[1.15] tracking-tight mb-5">
        Practice quizzes,<br />powered by AI.
      </h1>

      {/* Body */}
      <p className="text-base text-secondary mb-9">
        Paste your AI-generated quiz and start practicing with instant feedback.
      </p>

      {/* Primary CTA */}
      <button
        onClick={() => navigate("input")}
        className="w-full py-3.5 px-5 bg-accent text-white rounded-lg
                   text-base font-medium text-center shadow-card
                   hover:opacity-90 active:scale-[0.99]
                   transition-all duration-[150ms] ease-out
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg
                   mb-6"
      >
        Paste a Quiz →
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 text-sm text-secondary mb-6">
        <span className="flex-1 h-px bg-border" />
        <span>or</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Generate link */}
      <div className="text-center mb-12">
        <button
          onClick={() => navigate("prompt")}
          className="text-secondary text-base hover:text-primary transition-colors duration-[150ms]"
        >
          Don&apos;t have a quiz yet? Generate one with AI →
        </button>
      </div>

      {/* Recent sessions */}
      {history.length > 0 && (
        <div>
          <p className="text-2xs font-medium tracking-[0.1em] uppercase text-secondary mb-3">
            Recent
          </p>
          {history.map((entry, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${entry.topic} — ${entry.percentage}% on ${entry.date}`}
              className={`
                flex items-center justify-between py-3 border-border
                cursor-pointer hover:opacity-70 transition-opacity duration-[150ms]
                border-b ${i === 0 ? "border-t" : ""}
              `}
            >
              <span className="text-sm font-medium text-primary truncate max-w-[200px]">
                {entry.topic}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-success">{entry.percentage}%</span>
                <span className="text-xs text-secondary">{entry.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
