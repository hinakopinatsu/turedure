import { ImageResponse } from "next/og";

export const alt = "ツレヅレ — 一日一首。名を知らぬまま、心を知る。";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#f3efe5", color: "#39352f", fontFamily: "serif" }}>
      <div style={{ position: "absolute", width: 430, height: 430, borderRadius: 999, right: -115, top: -190, background: "#ddd5c2", opacity: .52 }} />
      <div style={{ position: "absolute", left: 82, top: 70, bottom: 70, width: 1, background: "#9b5046", opacity: .38 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 20, letterSpacing: 9, color: "#756e64" }}>一日一首。</div>
        <div style={{ marginTop: 43, fontSize: 78, letterSpacing: 28, paddingLeft: 28 }}>ツレヅレ</div>
        <div style={{ width: 310, height: 1, marginTop: 37, background: "#81766c", opacity: .35 }} />
        <div style={{ marginTop: 36, fontSize: 27, letterSpacing: 8, color: "#5f5951" }}>名を知らぬまま、心を知る。</div>
        <div style={{ marginTop: 25, fontSize: 17, letterSpacing: 5, color: "#8b8378" }}>匿名で短歌を交わす歌会</div>
      </div>
      <div style={{ position: "absolute", right: 84, bottom: 65, width: 12, height: 12, borderRadius: 999, border: "1px solid #9b5046" }} />
    </div>,
    size,
  );
}
