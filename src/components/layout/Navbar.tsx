"use client";

// Top navigation bar. Keep accessibility attributes and small, focused
// handlers here — navigation logic is delegated to `useAppStore`.

import { useEffect, useState } from "react";
import Image from "next/image";
import { Monitor, Moon, Sun } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getThemeMode, saveThemeMode } from "@/lib/storage";
import type { ThemeMode } from "@/types/quiz";

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  Icon: typeof Monitor;
}> = [
  { mode: "system", label: "System theme", Icon: Monitor },
  { mode: "light", label: "Light theme", Icon: Sun },
  { mode: "dark", label: "Dark theme", Icon: Moon },
];

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const theme = resolveTheme(mode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#131620" : "#f8f5ef"
  );
}

export default function Navbar() {
  const { navigate, state } = useAppStore();
  const inQuiz = state.view === "quiz";
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const storedMode = getThemeMode();
    setThemeMode(storedMode);
    applyTheme(storedMode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (getThemeMode() === "system") applyTheme("system");
    };

    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  const goHome = () => {
    if (typeof window !== "undefined" && /^\/share\/[A-Za-z0-9_-]{16}$/.test(window.location.pathname)) {
      window.history.replaceState({}, document.title, "/");
    }
    navigate("home");
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    saveThemeMode(mode);
    applyTheme(mode);
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 h-[52px] bg-bg border-b border-border
                 flex items-center justify-between px-6 z-[100]"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Left section: Logo or Back + Logo */}
      <div className="flex items-center gap-3">
        {inQuiz && (
          <button
            type="button"
            onClick={goHome}
            className="h-8 w-8 rounded-md border border-border bg-surface flex items-center justify-center text-secondary transition-colors duration-[150ms] hover:text-primary hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent btn-anim"
            aria-label="Back to home"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {/* Logo */}
        <button
          type="button"
          onClick={goHome}
          className="inline-flex items-center gap-2 text-[15px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
          aria-label="QuizCraft Plus — go to home"
        >
          <Image
            src="/logo.webp"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-md"
            priority
            aria-hidden="true"
          />
          <span>
            <span className="font-semibold text-primary">QuizCraft</span>
            <span className="font-normal text-secondary"> Plus</span>
          </span>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div role="group" className="flex items-center rounded-md border border-border bg-surface p-0.5" aria-label="Theme selector">
          {THEME_OPTIONS.map(({ mode, label, Icon }) => {
            const active = themeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleThemeChange(mode)}
                className={[
                  "h-7 w-7 rounded-[5px] flex items-center justify-center transition-colors duration-[150ms]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "bg-accent/10 text-primary"
                    : "text-secondary hover:text-primary",
                ].join(" ")}
                aria-label={label}
                aria-pressed={active}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* Get AI Prompt */}
        <button
          type="button"
          onClick={() => navigate("prompt")}
          data-tutorial="nav-prompt"
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms] hidden sm:block"
          aria-label="Get AI Prompt"
        >
          <span>Get AI Prompt</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("prompt")}
          data-tutorial="nav-prompt"
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms] sm:hidden"
          aria-label="Get AI Prompt"
        >
          Prompt
        </button>

      </div>
    </nav>
  );
}
