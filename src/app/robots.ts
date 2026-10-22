import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * What search engines may crawl. Only the landing page and the sign-in screen
 * are meant for strangers; everything else belongs to one signed-in person or
 * to the coach, and is turned away by the proxy anyway — listing it here keeps
 * crawlers from spending their budget on redirects to /login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/cms-preview",
        "/dashboard",
        "/account",
        "/form",
        "/api",
        "/export-diet",
        "/export-profile",
        "/export-workout",
        "/offline",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
