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

    let matches = false;
    // Safe legacy password check: only compare as plaintext if the DB password is NOT a bcrypt hash.
    // This prevents the hash-as-password vulnerability while still allowing legacy accounts to change their passwords.
    if (account.password.startsWith("$2a$") || account.password.startsWith("$2b$")) {
      /* A thrown bcrypt error is a server fault, not a wrong password. Folding it
         into `false` would answer "current password is incorrect" for a password
         that is actually correct, sending the user to chase a problem they cannot
         fix and hiding the real failure from the logs. */
      try {
        matches = await comparePassword(currentPassword, account.password);
      } catch (error) {
        console.error(`bcrypt comparison failed for account ${account.id}:`, error);
        return NextResponse.json(
          { error: "حدث خطأ داخلي في الخادم" },
          { status: 500 }
        );
      }
    } else {
      matches = (currentPassword === account.password);
    }

    if (!matches) {
      /* Never log the submitted password or the stored hash. */
      console.warn(`Failed password change attempt for account ${account.id}`);
      return NextResponse.json(
        { error: "كلمة المرور الحالية غير صحيحة" },
        { status: 401 }
      );
    }

    await prisma.accounts.update({
      where: { id: account.id },
      data: { password: await hashPassword(newPassword) },
    });

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
