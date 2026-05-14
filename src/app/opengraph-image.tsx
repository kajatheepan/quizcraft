import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "QuizCraft Plus - Practice AI Generated Quizzes";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 18% 20%, rgba(112, 90, 255, 0.24), transparent 32%), #131620",
          color: "#e5e8f2",
          padding: "72px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            color: "#b0b8ce",
            fontSize: "28px",
            fontWeight: 600,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #765cf6, #5231dc)",
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "-1px",
            }}
          >
            QC+
          </div>
          QuizCraft Plus
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h1
            style={{
              margin: 0,
              maxWidth: "900px",
              fontSize: "76px",
              lineHeight: 1.02,
              letterSpacing: "-1px",
              fontWeight: 700,
            }}
          >
            Practice AI generated quizzes faster.
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "820px",
              color: "#b0b8ce",
              fontSize: "31px",
              lineHeight: 1.35,
              fontWeight: 400,
            }}
          >
            Paste quizzes, answer with instant feedback, review mistakes, and focus your revision.
          </p>
        </div>

        <div style={{ display: "flex", gap: "14px", color: "#e5e8f2", fontSize: "24px" }}>
          {["Paste quiz", "Practice", "Review mistakes"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid #363b49",
                borderRadius: "999px",
                padding: "12px 20px",
                background: "rgba(29, 33, 44, 0.86)",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
