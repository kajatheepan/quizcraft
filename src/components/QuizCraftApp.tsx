"use client";

// App shell: mounts the top-level navbar, animated view container and
// global helpers (tutorial, toast). Keep this file focused on composition
// rather than business logic.

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import Navbar from "@/components/layout/Navbar";
import Toast from "@/components/ui/Toast";
import HomeView from "@/components/views/HomeView";
import InputView from "@/components/views/InputView";
import QuizView from "@/components/views/QuizView";
import ResultsView from "@/components/views/ResultsView";
import PromptView from "@/components/views/PromptView";
import InteractiveTutorial from "@/components/tutorial/InteractiveTutorial";
import type { ViewName } from "@/types/quiz";

const VIEW_COMPONENTS: Record<ViewName, React.ComponentType> = {
  home:    HomeView,
  input:   InputView,
  quiz:    QuizView,
  results: ResultsView,
  prompt:  PromptView,
};

// Animated view wrapper
function AnimatedView({
  name,
  active,
  children,
}: {
  name: ViewName;
  active: boolean;
  children: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(active);
  const [opacity, setOpacity] = useState(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      setRendered(true);
      // Slight delay to let DOM paint before fade-in
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpacity(1));
      });
      return () => cancelAnimationFrame(t);
    } else {
      setOpacity(0);
      const t = setTimeout(() => setRendered(false), 150);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!rendered) return null;

  return (
    <div
      role="main"
      aria-label={name}
      style={{
        opacity,
        transition: "opacity 150ms ease-out",
        position: active ? "relative" : "absolute",
        width: "100%",
        top: 0,
        left: 0,
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

export default function QuizCraftApp() {
  const { state, startQuiz, showToast } = useAppStore();
  const currentView = state.view;
  const [loadingShared, setLoadingShared] = useState(false);
  const loadedSharedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const compressed = params.get("q");
    const shareMatch = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]{16})$/);
    const shareId = shareMatch?.[1] ?? null;

    if (compressed) {
      if (loadedSharedRef.current === `q:${compressed}`) return;
      loadedSharedRef.current = `q:${compressed}`;
      setLoadingShared(true);
      const timer = setTimeout(() => {
        import("@/lib/compression")
          .then(({ decompressQuiz }) => decompressQuiz(compressed))
          .then((questions) => {
            if (questions && questions.length > 0) {
              startQuiz(questions, state.settings);
              showToast("Shared quiz loaded successfully!");
            } else {
              showToast("Shared quiz has no questions.");
            }
          })
          .catch((err) => {
            console.error("Decompression failed:", err);
            showToast("Failed to load shared quiz. Link may be broken.");
          })
          .finally(() => {
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
            setLoadingShared(false);
          });
      }, 300);

      return () => clearTimeout(timer);
    }

    if (shareId) {
      if (loadedSharedRef.current === `id:${shareId}`) return;
      loadedSharedRef.current = `id:${shareId}`;
      setLoadingShared(true);
      const timer = setTimeout(() => {
        fetch(`/api/share/${shareId}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Shared quiz not found");
            }
            return response.json();
          })
          .then((data) => {
            if (Array.isArray(data.questions) && data.questions.length > 0) {
              startQuiz(data.questions, state.settings);
              showToast("Shared quiz loaded successfully!");
            } else {
              showToast("Shared quiz has no questions.");
            }
          })
          .catch((err) => {
            console.error("Shared quiz lookup failed:", err);
            showToast("Shared quiz link is missing or expired.");
          })
          .finally(() => {
            setLoadingShared(false);
          });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [startQuiz, showToast, state.settings]);

  if (loadingShared) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 animate-fade-in text-center px-6">
          <div className="h-12 w-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
          <h2 className="text-lg font-semibold text-primary">Loading shared quiz...</h2>
          <p className="text-sm text-secondary">Preparing your active practice session</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ paddingTop: 52, minHeight: "100vh", position: "relative" }}>
        {(Object.keys(VIEW_COMPONENTS) as ViewName[]).map((name) => {
          const Component = VIEW_COMPONENTS[name];
          return (
            <AnimatedView key={name} name={name} active={currentView === name}>
              <Component />
            </AnimatedView>
          );
        })}
      </div>
      <InteractiveTutorial />
      <Toast />
    </>
  );
}
