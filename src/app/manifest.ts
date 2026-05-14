import type { MetadataRoute } from "next";

const description =
  "Paste AI-generated quizzes, practice with instant feedback, review mistakes, and study faster with QuizCraft Plus.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuizCraft Plus",
    short_name: "QuizCraft",
    description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#131620",
    theme_color: "#131620",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
