"use client";

// Top navigation bar. Keep accessibility attributes and small, focused
// handlers here — navigation logic is delegated to `useAppStore`.

import { useAppStore } from "@/store/useAppStore";

export default function Navbar() {
  const { navigate, state } = useAppStore();
  const inQuiz = state.view === "quiz";

  const handleLogo = () => {
    navigate("home");
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
            onClick={() => navigate("home")}
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
          onClick={handleLogo}
          onKeyDown={(e) => e.key === "Enter" && handleLogo()}
          className="text-[15px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
          aria-label="QuizCraft Plus — go to home"
        >
          <span className="font-semibold text-primary">QuizCraft</span>
          <span className="font-normal text-secondary"> Plus</span>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-5">
        {/* Get AI Prompt */}
        <button
          onClick={() => navigate("prompt")}
          data-tutorial="nav-prompt"
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms] hidden sm:block"
          aria-label="Get AI Prompt"
        >
          <span>Get AI Prompt</span>
        </button>
        <button
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
