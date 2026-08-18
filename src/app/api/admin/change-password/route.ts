import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireAdmin, startSession } from "@/lib/authGuard";

/* Sets a password without knowing the current one — which is the coach's
   prerogative and nobody else's. Unguarded, it was an account takeover for any
   `profileId`: the trainee's, and the coach's own. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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

    /* Stamping this is most of the point of the reset. The coach sets a
       trainee's password because the trainee cannot get in, or because someone
       else can — and in the second case leaving the old sessions alive resets
       nothing. From the next request, every token issued before now is refused.
       See `sessionRefusal` in @/lib/authGuard. */
    const account = await prisma.accounts.update({
      where: { id: profile.user_id },
      data: { password: hashedPassword, password_changed_at: new Date() },
      select: { id: true, username: true },
    });

    /* Unless the coach just reset their own password through the panel, which
       this endpoint allows. Signing them out of the panel for using it would be
       a confusing way to succeed, so their token is replaced the way
       /api/auth/change-password replaces the caller's — after the write, never
       before it, or the new token would be older than the change. */
    if (account.id === auth.session.userId) {
      await startSession(account, false, auth.session.expiresAt - auth.session.issuedAt);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin change password error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
