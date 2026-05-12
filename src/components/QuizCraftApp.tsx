"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import Navbar from "@/components/layout/Navbar";
import Toast from "@/components/ui/Toast";
import HomeView from "@/components/views/HomeView";
import InputView from "@/components/views/InputView";
import QuizView from "@/components/views/QuizView";
import ResultsView from "@/components/views/ResultsView";
import PromptView from "@/components/views/PromptView";
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
  const { state } = useAppStore();
  const currentView = state.view;

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
      <Toast />
    </>
  );
}
