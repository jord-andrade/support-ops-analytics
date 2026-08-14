import { ImageResponse } from "next/og";

export const alt = "SignalDesk — support operations analytics over 100,000 synthetic tickets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f3f1eb",
        color: "#132033",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "66px 72px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 800 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, background: "#c7f06a", borderRadius: 12, padding: 10, height: 52, width: 52 }}>
            <span style={{ background: "#132033", borderRadius: 3, height: 14, width: 7 }} />
            <span style={{ background: "#132033", borderRadius: 3, height: 30, width: 7 }} />
            <span style={{ background: "#132033", borderRadius: 3, height: 22, width: 7 }} />
          </div>
          SignalDesk
        </div>
        <span style={{ background: "#c7f06a", borderRadius: 30, fontSize: 18, fontWeight: 800, letterSpacing: 1, padding: "12px 18px" }}>100% SYNTHETIC</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#3155f5", fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>SUPPORT OPERATIONS / ANALYTICS</span>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 800, letterSpacing: -5, lineHeight: 0.95, marginTop: 22 }}>
          <span>See the queue.</span>
          <span style={{ color: "#3155f5" }}>Act on the signal.</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #132033", paddingTop: 22, fontSize: 22 }}>
        <span>100,000 deterministic tickets</span>
        <span style={{ fontFamily: "monospace" }}>jord-andrade.dev</span>
      </div>
    </div>,
    size,
  );
}
