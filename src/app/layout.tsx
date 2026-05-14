import type { Metadata } from "next";
import Script from "next/script";
import { STORAGE_KEY } from "@/lib/constants";
import "./globals.css";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const siteDescription =
  "Paste AI-generated quizzes, practice with instant feedback, review mistakes, and study faster with QuizCraft Plus.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "QuizCraft Plus",
  title: {
    default: "QuizCraft Plus | Practice AI Generated Quizzes",
    template: "%s | QuizCraft Plus",
  },
  description: siteDescription,
  keywords: [
    "AI quiz",
    "quiz practice",
    "study tool",
    "revision tool",
    "AI generated quizzes",
    "flashcard alternative",
    "learning app",
  ],
  authors: [{ name: "QuizCraft Plus" }],
  creator: "QuizCraft Plus",
  publisher: "QuizCraft Plus",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "QuizCraft Plus",
    title: "QuizCraft Plus | Practice AI Generated Quizzes",
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "QuizCraft Plus - Practice AI generated quizzes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuizCraft Plus | Practice AI Generated Quizzes",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
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
        meta.setAttribute("content", theme === "dark" ? "#131620" : "#f8f5ef");
      } catch {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#131620" />
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
