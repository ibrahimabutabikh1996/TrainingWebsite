import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { USERNAME_PATTERN, isReservedUsername } from "@/lib/auth";
import { isAdminUsername } from "@/lib/adminUsernames";
import { requireAdmin } from "@/lib/authGuard";

/* Renaming a trainee's sign-in name, which is the coach's prerogative and
 * nobody else's — the same standing as /api/admin/change-password next door.
 *
 * Nothing in the data model objects to this: every relation in the public
 * schema hangs off a UUID, so `accounts.username` is a label and renaming it
 * orphans no row. The one place it is not a label is `isAdminUsername`, which
 * decides what a session may do from the string itself — so the two refusals
 * below are what keep this endpoint from being a way to hand out the panel, or
 * to lose it.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { profileId, newUsername } = await request.json();

    if (!profileId || !newUsername) {
      return NextResponse.json(
        { error: "المعرف واسم المستخدم الجديد مطلوبان" },
        { status: 400 }
      );
    }

    /* Trimmed and lowercased once, and it is this value that is stored.
     *
     * Trimmed because /api/auth/login trims what the trainee types before it
     * looks the name up, so a stored name carrying a space is one nobody can
     * ever sign in with. Lowercased because that look-up is `findUnique` on a
     * case-sensitive Postgres column while `isAdminUsername` compares in lower
     * case: without this, `Ali` and `ali` are two different accounts that the
     * coach cannot tell apart, and a trainee who types their name in the wrong
     * case is refused with the sign-in screen's one deliberately unhelpful
     * sentence. */
    const cleanUsername = String(newUsername).trim().toLowerCase();

    /* The same rule the intake form and /api/admin/create-account apply — see
       `USERNAME_PATTERN` in @/lib/auth. A name set here is a name its owner has
       to reproduce at a sign-in screen. */
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      return NextResponse.json(
        { error: "اسم المستخدم يجب أن يكون بين 3 و32 خانة من حروف إنجليزية أو أرقام أو . _ -" },
        { status: 400 }
      );
    }

    /* Refused for the reason `isReservedUsername` exists: the names on that list
       are credentials in everything but name, and this would otherwise be a
       third way to claim one — the two account-creation paths already refuse
       them, and a rename that did not would reopen what they closed. */
    if (isReservedUsername(cleanUsername)) {
      return NextResponse.json(
        { error: "اسم المستخدم محجوز، يرجى اختيار اسم آخر" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { user_id: true },
    });

    if (!profile || !profile.user_id) {
      return NextResponse.json(
        { error: "لم يتم العثور على الحساب" },
        { status: 404 }
      );
    }

    const account = await prisma.accounts.findUnique({
      where: { id: profile.user_id },
      select: { username: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "لم يتم العثور على الحساب" },
        { status: 404 }
      );
    }

    /* The other half of the guard, and the one that is easy to miss: the check
       above stops anyone being renamed *into* the coach, this stops the coach
       being renamed *out of* themselves. Membership is a hard-coded list in
       @/lib/adminUsernames, so an admin account renamed away from it cannot
       reach the panel again — not to undo the rename, not at all — and the way
       back would be a code change and a deploy. /api/admin/change-password
       allows the coach to act on their own account through this panel, so this
       is a reachable mistake rather than a theoretical one. */
    if (isAdminUsername(account.username)) {
      return NextResponse.json(
        { error: "لا يمكن تغيير اسم حساب الإدارة من هذه الشاشة" },
        { status: 403 }
      );
    }

    /* Nothing to do, and saying so beats stamping the revocation below and
       signing a trainee out for a change that was not one. */
    if (account.username === cleanUsername) {
      return NextResponse.json(
        { error: "اسم المستخدم الجديد مطابق للحالي" },
        { status: 400 }
      );
    }

    try {
      const updated = await prisma.accounts.update({
        where: { id: profile.user_id },
        /* `password_changed_at` is stamped even though no password changed.
         *
         * It is the only lever this system has for disowning a token — see
         * `sessionRefusal` in @/lib/authGuard — and a rename needs it: the
         * token carries the old name in its payload, and the trainee would
         * otherwise stay signed in for up to a month under a name that no
         * longer exists in this table. Refusing it sends them back to /login,
         * which is where they learn the new name works and the old one does
         * not. The column's name is now narrower than what it records. */
        data: { username: cleanUsername, password_changed_at: new Date() },
        select: { username: true },
      });

      return NextResponse.json({ success: true, username: updated.username });
    } catch (error) {
      /* The look-up above and this update are two statements, so the unique
         index is what actually prevents a duplicate — same as
         /api/admin/create-account, where the same collision surfaced as the
         outer handler's "حدث خطأ" for something the coach could have fixed by
         choosing another name. */
      if ((error as { code?: string })?.code === "P2002") {
        return NextResponse.json(
          { error: "اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Admin change username error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
