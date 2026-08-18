import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/auth";
import { requireUser, startSession } from "@/lib/authGuard";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;

/* Changing your own password, and only your own.
 *
 * Two things have to hold, and neither substitutes for the other: the caller is
 * signed in as this account (the session cookie, which is signed and httpOnly),
 * and they know the current password (checked below, so a borrowed session
 * cannot lock the owner out).
 *
 * The account being changed comes from the session. It used to come from a
 * `userId` in the body, read out of `localStorage` — anyone could send any id,
 * and only the current-password check stood between that and setting a stranger's
 * password. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { currentPassword, newPassword } = await request.json();
    const userId = auth.session.userId;

    if (!currentPassword || !newPassword) {
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

    /* Stamped in the same write as the password itself, so the two cannot
       disagree: every session opened with the old password is refused from the
       next request onward. See `sessionRefusal` in @/lib/authGuard. */
    await prisma.accounts.update({
      where: { id: account.id },
      data: {
        password: await hashPassword(newPassword),
        password_changed_at: new Date(),
      },
    });

    /* Including this one — so it is replaced rather than left to be refused.
     *
     * Order matters and is the reason this sits after the write, not before: the
     * guard compares the stamp against the token's issue time, so a token minted
     * first would be older than the change that follows it and would be thrown
     * out on the next request. Changing your own password successfully must not
     * sign you out.
     *
     * The original lifetime is carried over rather than defaulted. Re-issuing at
     * the standard TTL would quietly demote someone who had ticked "remember me"
     * from a month to a week, as a side effect of an unrelated action. */
    await startSession(account, false, auth.session.expiresAt - auth.session.issuedAt);

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
