import type { MetadataRoute } from "next";

const origin = "https://turedure.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
