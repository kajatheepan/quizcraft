import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizCraft AI",
  description: "Practice quizzes, powered by AI. Paste your AI-generated quiz and start practicing with instant feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-primary font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
