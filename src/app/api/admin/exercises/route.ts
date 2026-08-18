import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authGuard";
import { safeVideoUrl } from "@/lib/videoEmbed";

export const runtime = "nodejs";

/* The exercise library is the coach's to write, on every verb — reading it
   included, since the whole of it is only ever shown inside the panel. */

const stripHamzas = (text?: string | null) => {
  if (!text) return text;
  return text.replace(/[أإآ]/g, "ا");
};

/* What actually reaches the table.
 *
 * These fields went in as they arrived. Two of them mattered:
 *
 *   video_url  is rendered on the trainee's dashboard as a link's `href` and as
 *              an embed's `src`. Unchecked, `javascript:...` stored here ran in
 *              a trainee's session — a field only the coach can write, reaching
 *              somebody else's browser. See `safeVideoUrl`.
 *
 *   the rest   had no length at all, and `stripHamzas` calls `.replace` on
 *              whatever it is handed, so a non-string threw before the row was
 *              ever built. */
const MAX_NAME = 160;
const MAX_SHORT = 80;
const MAX_NOTES = 1_000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function exerciseFields(data: unknown) {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return {
    name_ar: stripHamzas(text(d.name_ar, MAX_NAME)) || "",
    target_muscle: stripHamzas(text(d.target_muscle, MAX_SHORT)) || null,
    video_url: safeVideoUrl(d.video_url),
    notes: text(d.notes, MAX_NOTES),
    category: stripHamzas(text(d.category, MAX_SHORT)) || "مقاومة",
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const exercises = await prisma.exercises.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ exercises });
  } catch (error: unknown) {
    console.error("Admin Exercises Error:", error);
    return NextResponse.json({ error: "تعذّر جلب التمارين" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const fields = exerciseFields(await req.json());
    if (!fields.name_ar) {
      return NextResponse.json({ error: "اسم التمرين مطلوب" }, { status: 400 });
    }

    const newExercise = await prisma.exercises.create({ data: fields });
    return NextResponse.json(newExercise);
  } catch (error) {
    console.error("Failed to create exercise:", error);
    return NextResponse.json({ error: "تعذّر إضافة التمرين" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const data = await req.json();
    const id = typeof data?.id === "string" ? data.id : "";
    if (!id) {
      return NextResponse.json({ error: "معرّف التمرين مطلوب" }, { status: 400 });
    }

    const fields = exerciseFields(data);
    if (!fields.name_ar) {
      return NextResponse.json({ error: "اسم التمرين مطلوب" }, { status: 400 });
    }

    const updated = await prisma.exercises.update({ where: { id }, data: fields });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update exercise:", error);
    return NextResponse.json({ error: "تعذّر تعديل التمرين" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف التمرين مطلوب" }, { status: 400 });
    
    await prisma.exercises.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete exercise:", error);
    return NextResponse.json({ error: "تعذّر حذف التمرين" }, { status: 500 });
  }
}
