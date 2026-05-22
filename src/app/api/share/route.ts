import { NextResponse } from "next/server";
import { createSharedQuiz } from "@/lib/server/shareStore";

export async function POST(request: Request) {
  try {
    const { questions } = await request.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions are required" }, { status: 400 });
    }

    const share = await createSharedQuiz(questions);
    return NextResponse.json(share);
  } catch (error: any) {
    console.error("Share API route error:", error);
    return NextResponse.json({ error: error.message ?? "Failed to create share link" }, { status: 500 });
  }
}
