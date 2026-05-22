import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const COUNTER_KEY = "stats:quizzes_started";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis not configured");
  redis = new Redis({ url, token });
  return redis;
}

/** POST /api/track — fire-and-forget increment when a quiz is started */
export async function POST() {
  try {
    const count = await getRedis().incr(COUNTER_KEY);
    return NextResponse.json({ count });
  } catch (error: any) {
    // Never block the user — silently ignore tracking failures
    console.error("Track increment failed:", error?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/** GET /api/track — read the current count (for display on homepage) */
export async function GET() {
  try {
    const raw = await getRedis().get<number>(COUNTER_KEY);
    const count = typeof raw === "number" ? raw : parseInt(String(raw ?? "0"), 10) || 0;
    return NextResponse.json({ count }, {
      headers: {
        // Cache for 60s on CDN — fresh enough for a promo counter
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    console.error("Track read failed:", error?.message);
    // Return 0 gracefully — never crash the homepage
    return NextResponse.json({ count: 0 });
  }
}
