import { NextResponse } from "next/server";
import { getSharedQuizData, isValidShareId } from "@/lib/server/shareStore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shareId } = await params;
  if (!isValidShareId(shareId)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  try {
    const data = await getSharedQuizData(shareId);
    if (!data) {
      return NextResponse.json({ error: "Shared quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ questions: data.questions, title: data.title });
  } catch (error: any) {
    console.error("Shared quiz lookup failed:", error);
    return NextResponse.json({ error: error.message ?? "Failed to load shared quiz" }, { status: 500 });
  }
}
