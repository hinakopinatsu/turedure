import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://turedure.vercel.app"),
  title: "ツレヅレ｜匿名で短歌を交わす歌会",
  description: "一日一首。名を知らぬまま、心を知る。平安の歌文化を現代に再構成した匿名短歌SNS「ツレヅレ」。",
  keywords: ["短歌", "和歌", "歌会", "匿名短歌", "短歌SNS", "平安", "返歌"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  verification: { google: "M3Rfa44q6cStzUIE3FJP1YW7pzOLsex2qgyOBwk3iJA" },
  openGraph: {
    type: "website", locale: "ja_JP", url: "/", siteName: "ツレヅレ",
    title: "ツレヅレ｜匿名で短歌を交わす歌会",
    description: "一日一首。名を知らぬまま、心を知る。",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ツレヅレ — 一日一首。名を知らぬまま、心を知る。" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ツレヅレ｜匿名で短歌を交わす歌会",
    description: "一日一首。名を知らぬまま、心を知る。",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3efe5" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const websiteJsonLd = {
    "@context": "https://schema.org", "@type": "WebSite", name: "ツレヅレ",
    url: "https://turedure.vercel.app/",
    description: "一日一首。名を知らぬまま、心を知る。平安の歌文化を現代に再構成した匿名短歌SNS。",
    inLanguage: "ja",
  };
  return <html lang="ja"><body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\u003c") }} /></body></html>;
}
