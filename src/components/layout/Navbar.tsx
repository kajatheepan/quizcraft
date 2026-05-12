"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function Navbar() {
  const { state, navigate } = useAppStore();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleLogo = () => {
    if (state.view === "quiz") {
      if (confirm("Quit quiz? Your progress will be lost.")) {
        navigate("home");
      }
    } else {
      navigate("home");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

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

        {/* AI Dropdown */}
        <div ref={dropRef} className="relative">
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={dropOpen}
            className="border border-border text-secondary text-sm px-2.5 py-[5px]
                       rounded-md hover:text-primary hover:border-secondary
                       transition-colors duration-[150ms] focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open with AI ↓
          </button>

          {dropOpen && (
            <div
              role="menu"
              className="absolute top-11 right-0 bg-surface border border-border
                         rounded-lg shadow-card min-w-[180px] py-1.5 z-[200]"
            >
              <a
                href="https://chat.openai.com"
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block px-3.5 py-2.5 text-sm text-primary hover:bg-border
                           transition-colors duration-[150ms]"
                onClick={() => setDropOpen(false)}
              >
                ChatGPT ↗
              </a>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block px-3.5 py-2.5 text-sm text-primary hover:bg-border
                           transition-colors duration-[150ms]"
                onClick={() => setDropOpen(false)}
              >
                Claude ↗
              </a>
              <div className="mt-1 pt-1.5 px-3.5 pb-1.5 text-xs text-secondary border-t border-border">
                Copy the prompt first →{" "}
                <button
                  className="text-accent hover:underline"
                  onClick={() => { setDropOpen(false); navigate("prompt"); }}
                >
                  Generate prompt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
