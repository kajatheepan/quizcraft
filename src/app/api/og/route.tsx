import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const BRAND_DARK = "#131620";
const BRAND_SURFACE = "#1c2030";
const BRAND_ACCENT = "#7c6af7";
const BRAND_TEXT = "#e8eaf2";
const BRAND_SECONDARY = "#8a91b4";
const BRAND_SUCCESS = "#4ade80";
const BRAND_ERROR = "#f87171";
const BRAND_WARN = "#facc15";

const W = 1200;
const H = 630;

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function getGradeColor(pct: number) {
  if (pct >= 90) return BRAND_SUCCESS;
  if (pct >= 70) return BRAND_ACCENT;
  if (pct >= 50) return BRAND_WARN;
  return BRAND_ERROR;
}

function getGradeLabel(pct: number) {
  if (pct >= 90) return "Excellent Work!";
  if (pct >= 70) return "Good Job!";
  if (pct >= 50) return "Keep Practising";
  return "More Practice Needed";
}

function getGradeEmoji(pct: number) {
  if (pct >= 90) return "🏆";
  if (pct >= 70) return "🎯";
  if (pct >= 50) return "📚";
  return "💪";
}

// Satori rules:
// - No "background" shorthand with multiple layers or solid colors — use backgroundColor + backgroundImage
// - zIndex must be a number (unitless), not "1px"
// - No "inset" shorthand — use top/right/bottom/left separately
// - No "filter" blur — use box shadows for glow instead
// - "backdropFilter" is unsupported — remove it

function Background() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: BRAND_DARK,
        backgroundImage: `radial-gradient(ellipse 80% 60% at 15% 40%, ${BRAND_ACCENT}33 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 85% 80%, #1a9bdc22 0%, transparent 60%)`,
        display: "flex",
      }}
    />
  );
}

function Wordmark({ subtitle }: { subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: BRAND_ACCENT, display: "flex" }} />
        <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: `${BRAND_ACCENT}99`, marginTop: 5, display: "flex" }} />
        <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: `${BRAND_ACCENT}66`, marginTop: 10, display: "flex" }} />
      </div>
      <span style={{ fontSize: 20, fontWeight: 600, color: BRAND_TEXT, letterSpacing: -0.3 }}>
        QuizCraft Plus
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: BRAND_ACCENT,
            backgroundColor: `${BRAND_ACCENT}22`,
            borderRadius: 20,
            padding: "3px 10px",
            marginLeft: 4,
            display: "flex",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function QuizOGImage({ title, count }: { title: string; count: number }) {
  const displayTitle = clamp(title || "Untitled Quiz", 80);

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: BRAND_DARK,
      }}
    >
      <Background />

      {/* Decorative accent ring top-right */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: `2px solid ${BRAND_ACCENT}33`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 260,
          height: 260,
          borderRadius: "50%",
          border: `1px solid ${BRAND_ACCENT}22`,
          display: "flex",
        }}
      />

      {/* Content layer — zIndex must be a number */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 64px",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Wordmark subtitle="Practice Quiz" />

        {/* Middle: Title card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: `${BRAND_SURFACE}dd`,
              borderRadius: 20,
              padding: "36px 48px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: `0 0 0 1px ${BRAND_ACCENT}44`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: BRAND_ACCENT, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Quiz Ready
            </span>

            <div
              style={{
                fontSize: displayTitle.length > 50 ? 40 : 52,
                fontWeight: 700,
                color: BRAND_TEXT,
                lineHeight: 1.15,
                letterSpacing: -1.2,
                display: "flex",
              }}
            >
              {displayTitle}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, paddingTop: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: `${BRAND_ACCENT}22`,
              borderRadius: 100,
              padding: "8px 20px",
              boxShadow: `0 0 0 1px ${BRAND_ACCENT}44`,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: BRAND_ACCENT, display: "flex" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: BRAND_TEXT }}>
              {count} question{count !== 1 ? "s" : ""}
            </span>
          </div>

          <span style={{ color: BRAND_SECONDARY, fontSize: 16 }}>·</span>
          <span style={{ fontSize: 16, color: BRAND_SECONDARY }}>Practice now at quizcraft.app</span>
        </div>
      </div>
    </div>
  );
}

function ScoreOGImage({
  title,
  score,
  total,
  pct,
}: {
  title: string;
  score: number;
  total: number;
  pct: number;
}) {
  const displayTitle = clamp(title || "Quiz Result", 70);
  const gradeColor = getGradeColor(pct);
  const gradeLabel = getGradeLabel(pct);
  const gradeEmoji = getGradeEmoji(pct);
  const barFillWidth = Math.round((pct / 100) * 520);

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: BRAND_DARK,
      }}
    >
      <Background />

      {/* Grade colour glow blob — use box-shadow on a transparent div instead of filter: blur */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 500,
          width: 280,
          height: 160,
          borderRadius: "50%",
          backgroundColor: "transparent",
          boxShadow: `0 0 120px 60px ${gradeColor}22`,
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 64px",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Wordmark />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              fontWeight: 600,
              color: gradeColor,
              backgroundColor: `${gradeColor}22`,
              borderRadius: 100,
              padding: "8px 20px",
              boxShadow: `0 0 0 1px ${gradeColor}44`,
            }}
          >
            {gradeEmoji}  {gradeLabel}
          </div>
        </div>

        {/* Score display */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span
              style={{
                fontSize: 100,
                fontWeight: 800,
                color: gradeColor,
                letterSpacing: -4,
                lineHeight: 1,
              }}
            >
              {score}
            </span>
            <span style={{ fontSize: 48, fontWeight: 400, color: BRAND_SECONDARY, letterSpacing: -1 }}>
              / {total}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: 20,
                backgroundColor: `${gradeColor}22`,
                borderRadius: 12,
                padding: "10px 22px",
                boxShadow: `0 0 0 1px ${gradeColor}44`,
              }}
            >
              <span style={{ fontSize: 36, fontWeight: 700, color: gradeColor }}>
                {pct}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              display: "flex",
              width: 620,
              height: 8,
              backgroundColor: `${BRAND_TEXT}22`,
              borderRadius: 100,
              marginTop: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: barFillWidth,
                height: "100%",
                backgroundColor: gradeColor,
                borderRadius: 100,
                display: "flex",
              }}
            />
          </div>

          {/* Quiz title label */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: BRAND_SECONDARY, letterSpacing: 1.2, textTransform: "uppercase" }}>
              Quiz
            </span>
            <span style={{ fontSize: 24, fontWeight: 600, color: BRAND_TEXT, letterSpacing: -0.4 }}>
              {displayTitle}
            </span>
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 16, color: BRAND_SECONDARY }}>
            Practice at quizcraft.app
          </span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: BRAND_SECONDARY, display: "flex" }} />
          <span style={{ fontSize: 16, color: BRAND_SECONDARY }}>
            Free · No sign-up needed
          </span>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "quiz";

  let imageElement: React.ReactElement;

  if (type === "score") {
    const title = searchParams.get("title") ?? "Quiz Result";
    const score = parseInt(searchParams.get("score") ?? "0", 10);
    const total = parseInt(searchParams.get("total") ?? "0", 10);
    const pct = parseInt(searchParams.get("pct") ?? "0", 10);

    imageElement = (
      <ScoreOGImage title={title} score={score} total={total} pct={pct} />
    );
  } else {
    const title = searchParams.get("title") ?? "Untitled Quiz";
    const count = parseInt(searchParams.get("count") ?? "0", 10);

    imageElement = <QuizOGImage title={title} count={count} />;
  }

  return new ImageResponse(imageElement, {
    width: W,
    height: H,
    headers: {
      "Cache-Control": type === "score"
        ? "public, max-age=3600, s-maxage=3600"
        : "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
