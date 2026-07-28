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

    /* bcrypt is the only comparison that can be right.
       There used to be a plain-text fallback here for "legacy passwords", which
       compared the submitted string against the stored one — and the stored one
       is the hash. Anyone who ever saw the hash could send it back as the
       password and be let in. Every write path (create-account, change-password)
       hashes, so no account can hold a plain-text password to rescue.
       A malformed hash throws; that must mean nobody gets in, not everybody. */
    const isMatch = await comparePassword(password, account.password).catch(() => false);

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
