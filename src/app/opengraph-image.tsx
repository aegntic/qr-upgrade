import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "QR Upgrade — Your brand. Every scan.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#f6f5ee",
        color: "#20251d",
        width: "100%",
        height: "100%",
        padding: "70px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 36, display: "flex" }}>↗ qrupgrade</div>
      <div
        style={{
          fontSize: 112,
          lineHeight: 1.02,
          letterSpacing: -6,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>Your brand.</span>
        <span>Every scan.</span>
      </div>
      <div
        style={{
          fontSize: 24,
          display: "flex",
          background: "#d4ef76",
          padding: 16,
        }}
      >
        DESIGN IT. PLACE IT. PUT IT TO THE TEST.
      </div>
    </div>,
    size,
  );
}
