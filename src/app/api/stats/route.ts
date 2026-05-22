import { NextResponse } from "next/server";
import { getQuizStats } from "@/lib/server/statsStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getQuizStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    console.error("Stats read failed:", error?.message ?? error);
    return NextResponse.json({ quizzesStarted: 0, quizzesShared: 0 });
  }
}