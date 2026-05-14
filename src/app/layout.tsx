import type { Metadata } from "next";
import Script from "next/script";
import { STORAGE_KEY } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizCraft Plus",
  description: "Practice quizzes, powered by AI. Paste your AI-generated quiz and start practicing with instant feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function() {
      try {
        var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
        var stored = raw ? JSON.parse(raw) : {};
        var mode = stored.themeMode === "light" || stored.themeMode === "dark" || stored.themeMode === "system"
          ? stored.themeMode
          : "system";
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var theme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "theme-color");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", theme === "dark" ? "#0f0f0f" : "#f8f5ef");
      } catch {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f0f0f" />
        <Script id="quizcraft-theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="bg-bg text-primary font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
