import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { profileId, newPassword } = await request.json();

    if (!profileId || !newPassword) {
      return NextResponse.json(
        { error: "المعرف وكلمة المرور الجديدة مطلوبان" },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
    });

    if (!profile || !profile.user_id) {
      return NextResponse.json(
        { error: "لم يتم العثور على الحساب" },
        { status: 404 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.accounts.update({
      where: { id: profile.user_id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin change password error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
