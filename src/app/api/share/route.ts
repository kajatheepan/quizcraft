import { NextResponse } from "next/server";
import { createSharedQuiz } from "@/lib/server/shareStore";
import { incrementQuizzesShared } from "@/lib/server/statsStore";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { questions, title } = await request.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions are required" }, { status: 400 });
    }

    const share = await createSharedQuiz(questions, typeof title === "string" ? title : undefined);
    await incrementQuizzesShared().catch((error) => {
      console.error("Share counter increment failed:", error);
    });
    return NextResponse.json(share);
  } catch (error: any) {
    console.error("Share API route error:", error);
    return NextResponse.json({ error: error.message ?? "Failed to create share link" }, { status: 500 });
  }
}
