import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://signaldesk-ops.vercel.app", lastModified: new Date("2026-08-14"), changeFrequency: "monthly", priority: 1 }];
}
