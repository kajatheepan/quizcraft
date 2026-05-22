import type { Metadata } from "next";
import QuizCraftApp from "@/components/QuizCraftApp";
import { getSharedQuizMeta, isValidShareId, getPublicSiteUrl } from "@/lib/server/shareStore";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getPublicSiteUrl();

  if (!isValidShareId(id)) {
    return {
      title: "Shared Quiz | QuizCraft Plus",
    };
  }

  let title = "Shared Quiz";
  let count = 0;

  try {
    const meta = await getSharedQuizMeta(id);
    if (meta) {
      title = meta.title || "Shared Quiz";
      count = meta.count;
    }
  } catch {
    // Redis not available in dev or meta fetch failed — use fallback
  }

  const displayTitle = title || "Shared Quiz";
  const ogTitle = `${displayTitle} | QuizCraft Plus`;
  const ogDescription = count > 0
    ? `Practice this ${count}-question quiz on QuizCraft Plus — free, no sign-up needed.`
    : "Practice this quiz on QuizCraft Plus — free, no sign-up needed.";

  const ogImageUrl = `${siteUrl}/api/og?type=quiz&title=${encodeURIComponent(displayTitle)}&count=${count}&shareId=${id}`;

  return {
    title: ogTitle,
    description: ogDescription,
    openGraph: {
      type: "website",
      url: `${siteUrl}/share/${id}`,
      siteName: "QuizCraft Plus",
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: displayTitle,
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

export default function SharedQuizPage() {
  return <QuizCraftApp />;
}
