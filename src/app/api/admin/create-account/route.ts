import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { credentialError, hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/authGuard";
import type { JsonRecord } from "@/types";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { profileId, username, password } = await request.json();

    if (!profileId || !username || !password) {
      return NextResponse.json(
        { error: "المعرف واسم المستخدم وكلمة المرور مطلوبة" },
        { status: 400 }
      );
    }

    /* The same rule the intake form applies — see `@/lib/auth`. This path used
       to check the password's length and nothing about the username at all, so
       an account could be made here that its owner then had to reproduce
       exactly at a sign-in screen. `password.length` was also read off whatever
       arrived: a number has no `length`, `undefined < 8` is false, and it went
       through to bcrypt. */
    const credentialProblem = credentialError(username, password);
    if (credentialProblem) {
      return NextResponse.json({ error: credentialProblem }, { status: 400 });
    }

    // Check if the username already exists
    const existingAccount = await prisma.accounts.findUnique({
      where: { username },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر" },
        { status: 400 }
      );
    }

    // Check if the profile exists
    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "المشترك غير موجود" },
        { status: 404 }
      );
    }

    if (profile.user_id) {
      return NextResponse.json(
        { error: "هذا المشترك لديه حساب بالفعل" },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the account and link it to the profile
    const newAccount = await prisma.$transaction(async (tx) => {
      const account = await tx.accounts.create({
        data: {
          username,
          password: hashedPassword,
        },
      });

      /* `|| {}` for the same reason as /api/admin/renew-account: the column is
         nullable, and assigning onto null throws. */
      let currentData = (profile.data as JsonRecord) || {};
      if (typeof currentData === "string") {
        try { currentData = JSON.parse(currentData); } catch { currentData = {}; }
      }
      // New accounts start suspended until the coach activates them.
      currentData.is_suspended = true;

      await tx.profiles.update({
        where: { id: profileId },
        data: {
          user_id: account.id,
          data: currentData,
          is_suspended: true,
        },
      });

      return account;
    });

    return NextResponse.json({
      success: true,
      message: "تم إنشاء الحساب وربطه بنجاح",
      accountId: newAccount.id,
      username: newAccount.username,
    });
    
  } catch (error: unknown) {
    /* The look-up above and this insert are two statements. `accounts.username`
       being unique is what actually prevents a duplicate; without this the
       second of two simultaneous requests surfaced as "حدث خطأ" for something
       the coach could have fixed by choosing another name. */
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر" },
        { status: 400 }
      );
    }

    console.error("Create Account API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
