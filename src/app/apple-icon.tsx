import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "40px",
          background: "#705aff",
          color: "#ffffff",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "96px",
          fontWeight: 700,
        }}
      >
        Q
      </div>
    ),
    size,
  );
}
