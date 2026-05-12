"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function Navbar() {
  const { state, navigate } = useAppStore();

  const handleLogo = () => {
    if (state.view === "quiz") {
      if (confirm("Quit quiz? Your progress will be lost.")) {
        navigate("home");
      }
    } else {
      navigate("home");
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 h-[52px] bg-bg border-b border-border
                 flex items-center justify-between px-6 z-[100]"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <button
        onClick={handleLogo}
        onKeyDown={(e) => e.key === "Enter" && handleLogo()}
        className="text-[15px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
        aria-label="QuizCraft AI — go to home"
      >
        <span className="font-semibold text-primary">QuizCraft</span>
        <span className="font-normal text-secondary"> AI</span>
      </button>

      {/* Right */}
      <div className="flex items-center gap-5">
        {/* Get AI Prompt */}
        <button
          onClick={() => navigate("prompt")}
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms] hidden sm:block"
          aria-label="Get AI Prompt"
        >
          <span>Get AI Prompt</span>
        </button>
        <button
          onClick={() => navigate("prompt")}
          className="text-secondary text-sm hover:text-primary transition-colors duration-[150ms] sm:hidden"
          aria-label="Get AI Prompt"
        >
          Prompt
        </button>

      </div>
    </nav>
  );
}
