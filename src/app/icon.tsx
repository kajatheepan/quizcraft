import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          background: "#705aff",
          color: "#ffffff",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        Q
      </div>
    ),
    size,
  );
}
