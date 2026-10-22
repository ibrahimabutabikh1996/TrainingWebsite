import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/** The public pages, and only those — see `robots.ts` for the rest. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
