"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function Toast() {
  const { state } = useAppStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state.toastMessage) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [state.toastMessage]);

  if (!state.toastMessage && !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed bottom-7 left-1/2 z-[1000] pointer-events-none
        -translate-x-1/2 whitespace-nowrap
        bg-surface border border-border rounded-lg px-5 py-2.5
        text-sm text-primary shadow-card
        transition-all duration-[150ms] ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(20px)" }}
    >
      {state.toastMessage}
    </div>
  );
}
