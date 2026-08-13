import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
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
  try {
    const data = await req.json();
    const newExercise = await prisma.exercises.create({
      data: {
        name_ar: data.name_ar,
        target_muscle: data.target_muscle || null,
        video_url: data.video_url || null,
        notes: data.notes || null,
        category: data.category || "مقاومة",
      },
    });
    return NextResponse.json(newExercise);
  } catch (error) {
    console.error("Failed to create exercise:", error);
    return NextResponse.json({ error: "تعذّر إضافة التمرين" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const updated = await prisma.exercises.update({
      where: { id: data.id },
      data: {
        name_ar: data.name_ar,
        target_muscle: data.target_muscle || null,
        video_url: data.video_url || null,
        notes: data.notes || null,
        category: data.category || "مقاومة",
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update exercise:", error);
    return NextResponse.json({ error: "تعذّر تعديل التمرين" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
