"use server";

import { prisma } from "@/lib/db";

/**
 * The seasonal switches, for pages other than the landing page.
 *
 * `christmas_effect_active` is saved with the rest of the landing content, which
 * only the landing page reads. SeasonalLayer (mounted once in the root layout)
 * asks for it here — one key, read on the client after the page is up, so no
 * page becomes dynamic because of it. It is the same value the content manager
 * shows, and as public as the landing page that already prints it.
 */
export async function getSeasonalFlags(): Promise<{ christmas: boolean }> {
  try {
    const row = await prisma.site_settings.findUnique({
      where: { id: "landing_content" },
      select: { content_ar: true },
    });
    const content = row?.content_ar as Record<string, unknown> | null | undefined;
    return { christmas: content?.christmas_effect_active === "true" };
  } catch (error) {
    console.error("Failed to read seasonal flags:", error);
    return { christmas: false };
  }
}
