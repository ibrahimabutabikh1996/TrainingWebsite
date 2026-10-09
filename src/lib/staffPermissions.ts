/* What a staff member may be granted, and how a grant is read.
 *
 * A staff member is an account the coach created for a helper — see
 * `staff_accounts` in prisma/schema.prisma. The coach picks, per panel section,
 * one of three levels, plus any of four sensitive actions on subscribers. They
 * are stored as plain strings in `staff_accounts.permissions`:
 *
 *   "<section>.view"   sees the section, saves nothing in it
 *   "<section>.edit"   sees it and works in it (implies view)
 *   neither            the section is hidden and every request to it refused
 *   "subscribers.renew" | ".suspend" | ".accounts" | ".delete"
 *
 * Shared by the server, which decides, and the browser, which only draws the
 * matching navigation and checkboxes. As with `@/lib/adminUsernames`, only the
 * first of those is a decision — `@/lib/authGuard` is where it is made.
 *
 * Never granted to anyone but the coach: managing staff, and the coach's own
 * credentials. Those guards take no permission at all.
 */

export const STAFF_SECTIONS = [
  { key: "subscribers", label: "المشتركون", hint: "القائمة، ملف المشترك، الملاحظات، المرفقات، السجل الشهري", home: "/admin" },
  { key: "courses", label: "الكورسات", hint: "مكتبة الكورسات، صانع الكورسات، تعيين كورس لمشترك", home: "/admin/courses" },
  { key: "exercises", label: "التمارين", hint: "مكتبة التمارين", home: "/admin/exercises" },
  { key: "diet", label: "النظام الغذائي", hint: "مصادر الطعام، الأنظمة، مكتبة الأنظمة الغذائية", home: "/admin/diet" },
  { key: "cms", label: "محتوى الموقع", hint: "الصفحة الرئيسية والصور", home: "/admin/cms" },
] as const;

export type StaffSection = (typeof STAFF_SECTIONS)[number]["key"];

export type SectionLevel = "none" | "view" | "edit";

export const SECTION_LEVELS: readonly { value: SectionLevel; label: string }[] = [
  { value: "none", label: "مخفي" },
  { value: "view", label: "مشاهدة فقط" },
  { value: "edit", label: "تعديل" },
];

/* The sensitive actions on subscribers. Each is granted on its own, and only
   alongside some access to the subscribers section — they are buttons on its
   screens, so without it there is nowhere to press them. */
export const STAFF_ACTIONS = [
  { key: "subscribers.renew", label: "قبول التجديد أو رفضه" },
  { key: "subscribers.suspend", label: "إيقاف حساب مشترك أو تفعيله" },
  { key: "subscribers.accounts", label: "إنشاء حسابات المشتركين وتغيير أسمائهم وكلمات مرورهم" },
  { key: "subscribers.delete", label: "حذف مشترك" },
] as const;

export type StaffAction = (typeof STAFF_ACTIONS)[number]["key"];

export type StaffPermission = `${StaffSection}.view` | `${StaffSection}.edit` | StaffAction;

/** Whether a grant includes `needed`. Edit includes view. */
export function hasPermission(granted: readonly string[] | undefined, needed: StaffPermission): boolean {
  if (!granted) return false;
  if (granted.includes(needed)) return true;
  if (needed.endsWith(".view")) return granted.includes(`${needed.slice(0, -".view".length)}.edit`);
  return false;
}

export function sectionLevel(granted: readonly string[] | undefined, section: StaffSection): SectionLevel {
  if (hasPermission(granted, `${section}.edit`)) return "edit";
  if (hasPermission(granted, `${section}.view`)) return "view";
  return "none";
}

/**
 * The first panel screen this grant may open, or null if it opens none.
 * Where a staff member is sent when they land somewhere they may not be.
 */
export function firstAllowedPath(granted: readonly string[] | undefined): string | null {
  const section = STAFF_SECTIONS.find((s) => hasPermission(granted, `${s.key}.view`));
  return section ? section.home : null;
}

/**
 * A grant as it may be stored: known strings only, one level per section, and
 * the subscriber actions dropped when the subscribers section is hidden.
 * Whatever arrives from the browser goes through this before it is written.
 */
export function normalizePermissions(input: unknown): StaffPermission[] {
  const given = Array.isArray(input) ? input.filter((p): p is string => typeof p === "string") : [];
  const result: StaffPermission[] = [];

  for (const { key } of STAFF_SECTIONS) {
    const level = sectionLevel(given, key);
    if (level !== "none") result.push(`${key}.${level}`);
  }

  if (sectionLevel(given, "subscribers") !== "none") {
    for (const { key } of STAFF_ACTIONS) {
      if (given.includes(key)) result.push(key);
    }
  }

  return result;
}
