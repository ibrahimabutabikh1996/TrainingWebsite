"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { STORE_SETTINGS_ID, getStoreSettings } from "@/lib/store/catalog";
import { normalizeSettings } from "@/lib/store/types";
import { cleanDraft, EMPTY_DRAFT, type StoreContentDraft } from "@/lib/store/content";

/* The store content screen's writes. The coach only, like every other store
 * action — `requireAdminAction()` with no grant named.
 *
 * The draft is one row in `site_settings`, beside the store settings and
 * never read by the storefront. It holds only the fields that differ from
 * what is published; see @/lib/store/content. */

const DRAFT_ID = "store_content_draft";

type Result = { success: true } | { success: false; error: string };
const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

/** The saved draft, or an empty one. */
export async function loadStoreContentDraft(): Promise<StoreContentDraft> {
  if (!(await requireAdminAction())) return EMPTY_DRAFT;
  try {
    const row = await prisma.site_settings.findUnique({ where: { id: DRAFT_ID } });
    return row ? cleanDraft(row.content_ar) : EMPTY_DRAFT;
  } catch (error) {
    console.error("[store content] Failed to read the draft:", error);
    return EMPTY_DRAFT;
  }
}

export async function saveStoreContentDraft(input: StoreContentDraft): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  const draft = cleanDraft(input);
  try {
    await prisma.site_settings.upsert({
      where: { id: DRAFT_ID },
      update: { content_ar: draft as unknown as object },
      create: { id: DRAFT_ID, content_ar: draft as unknown as object },
    });
    return { success: true };
  } catch (error) {
    console.error("[store content] Failed to save the draft:", error);
    return { success: false, error: "تعذّر حفظ المسودة" };
  }
}

export async function discardStoreContentDraft(): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  try {
    await prisma.site_settings.deleteMany({ where: { id: DRAFT_ID } });
    return { success: true };
  } catch (error) {
    console.error("[store content] Failed to discard the draft:", error);
    return { success: false, error: "تعذّر حذف المسودة" };
  }
}

/**
 * Puts the draft in front of visitors.
 *
 * Only the fields the draft carries are written. The settings are read fresh
 * and the copy laid over them, so anything else changed in the store settings
 * since the draft began stays as it is; each product gets only its edited text
 * fields. A product deleted in the meantime is skipped. All of it, and the
 * draft's removal, in one transaction.
 */
export async function publishStoreContent(input: StoreContentDraft): Promise<Result> {
  if (!(await requireAdminAction())) return DENIED;
  const draft = cleanDraft(input);

  for (const fields of Object.values(draft.products)) {
    if (fields.name !== undefined && !fields.name.trim()) {
      return { success: false, error: "اسم المنتج لا يمكن أن يكون فارغاً" };
    }
  }

  try {
    const current = await getStoreSettings();
    const settings = normalizeSettings({ ...current, ...draft.texts });

    const ids = Object.keys(draft.products);
    const existing = ids.length
      ? await prisma.store_products.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } })
      : [];

    await prisma.$transaction([
      prisma.site_settings.upsert({
        where: { id: STORE_SETTINGS_ID },
        update: { content_ar: settings as unknown as object },
        create: { id: STORE_SETTINGS_ID, content_ar: settings as unknown as object },
      }),
      ...existing.map((row) => {
        const fields = draft.products[row.id];
        return prisma.store_products.update({
          where: { id: row.id },
          data: {
            ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
            ...(fields.tagline !== undefined ? { tagline: fields.tagline.trim() } : {}),
            ...(fields.description !== undefined ? { description: fields.description.trim() } : {}),
          },
        });
      }),
      prisma.site_settings.deleteMany({ where: { id: DRAFT_ID } }),
    ]);

    revalidatePath("/store", "layout");
    revalidatePath("/admin/store", "layout");
    return { success: true };
  } catch (error) {
    console.error("[store content] Failed to publish:", error);
    return { success: false, error: "تعذّر النشر" };
  }
}
