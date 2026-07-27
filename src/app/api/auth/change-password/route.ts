import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;

/* Identity here rests entirely on knowing the CURRENT password.
   Sign-in state lives in the browser's local storage, which anyone can forge,
   so the stored user id alone proves nothing — without this check a visitor
   could set any account's password by guessing an id. */
export async function POST(request: Request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "جميع الحقول مطلوبة" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
      return NextResponse.json(
        { error: `كلمة المرور الجديدة يجب ألا تقل عن ${MIN_LENGTH} خانات` },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "كلمة المرور الجديدة مطابقة للحالية" },
        { status: 400 }
      );
    }

    const account = await prisma.accounts.findUnique({ where: { id: userId } });
    if (!account) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    /* bcrypt only. The plain-text fallback that used to follow this compared the
       submitted string against the stored one — which is the hash — so knowing
       the hash was enough to take over the account. Every write path hashes, so
       nothing legitimate needed that escape hatch. */
    const matches = await comparePassword(currentPassword, account.password).catch(() => false);

    if (!matches) {
      return NextResponse.json(
        { error: "كلمة المرور الحالية غير صحيحة" },
        { status: 401 }
      );
    }

    await prisma.accounts.update({
      where: { id: account.id },
      data: { password: await hashPassword(newPassword) },
    });

    // Never log the submitted values.
    console.log(`Password changed for account ${account.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
