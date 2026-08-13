import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "اسم المستخدم وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    const account = await prisma.accounts.findUnique({
      where: { username },
    });

    if (!account) {
      return NextResponse.json(
        { error: "اسم المستخدم غير موجود" },
        { status: 401 }
      );
    }

    /* Newest first, matching /api/profile: that is the profile the dashboard will
       load, so it is the one whose suspension has to be honoured here. */
    const profile = await prisma.profiles.findFirst({
      where: { user_id: account.id },
      orderBy: { created_at: "desc" },
    });

    /* Read the suspension flag from its column. It used to be looked up inside
       the JSON blob, where a renamed or misspelled key would have silently let
       a suspended account straight through. */
    if (profile?.is_suspended) {
      return NextResponse.json(
        { error: "الحساب متوقف يرجى التواصل مع الادارة" },
        { status: 403 }
      );
    }

    let isMatch = false;
    // Safe legacy password check: only compare as plaintext if the DB password is NOT a bcrypt hash.
    // This prevents the hash-as-password vulnerability while still allowing legacy accounts to log in.
    if (account.password.startsWith("$2a$") || account.password.startsWith("$2b$")) {
      /* Matches the handling in /api/auth/change-password: a bcrypt fault must not
         be reported as a wrong password, or the two screens would both reject a
         correct password with no trace of the real cause. */
      try {
        isMatch = await comparePassword(password, account.password);
      } catch (error) {
        console.error(`bcrypt comparison failed for account ${account.id}:`, error);
        return NextResponse.json(
          { error: "حدث خطأ أثناء تسجيل الدخول" },
          { status: 500 }
        );
      }
    } else {
      isMatch = (password === account.password);
    }

    if (!isMatch) {
      return NextResponse.json(
        { error: "كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: account.id,
      username: account.username,
    });
  } catch (error: unknown) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
