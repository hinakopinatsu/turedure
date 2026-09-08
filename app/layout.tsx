import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ツレヅレ — つながらないから、言葉と出会える。",
  description: "一日一首、名も知らぬ誰かと歌を交わす場所。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3efe5" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
