import type { Metadata } from "next";
import QuizCraftApp from "@/components/QuizCraftApp";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ t?: string; s?: string; n?: string; pct?: string }>;
};

function getSiteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  return (url.startsWith("http") ? url : `https://${url}`).replace(/\/$/, "");
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const siteUrl = getSiteUrl();

  const title = typeof params.t === "string" ? decodeURIComponent(params.t) : "Quiz Result";
  const score = parseInt(params.s ?? "0", 10);
  const total = parseInt(params.n ?? "0", 10);
  const pct = parseInt(params.pct ?? "0", 10);

  const ogTitle = `${score}/${total} · ${pct}% — ${title} | QuizCraft Plus`;
  const ogDescription = pct >= 90
    ? `Scored ${pct}% on "${title}" — Excellent work! Try this quiz on QuizCraft Plus.`
    : pct >= 70
    ? `Scored ${pct}% on "${title}" — Good job! Practice on QuizCraft Plus.`
    : `Scored ${pct}% on "${title}". Keep practising on QuizCraft Plus — free, no sign-up!`;

  const ogImageUrl = `${siteUrl}/api/og?type=score&title=${encodeURIComponent(title)}&score=${score}&total=${total}&pct=${pct}`;

  return {
    title: ogTitle,
    description: ogDescription,
    openGraph: {
      type: "website",
      siteName: "QuizCraft Plus",
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `Score: ${score}/${total} (${pct}%) on ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImageUrl],
    },
  };
}

export default function ScoreSharePage() {
  // Just render the main app — the OG metadata is served to crawlers
  // Human visitors will see the full QuizCraft app
  return <QuizCraftApp />;
}
