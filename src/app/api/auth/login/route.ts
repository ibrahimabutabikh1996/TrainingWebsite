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

    // In a real scenario, use comparePassword(password, account.password)
    // if passwords are encrypted. Here we fallback to plain comparison 
    // if bcrypt throws an error (in case old passwords are plain text).
    let isMatch = false;
    try {
      // First try bcrypt compare
      isMatch = await comparePassword(password, account.password);
    } catch (e) {
      // If bcrypt fails, fallback to plain text comparison
      isMatch = account.password === password;
    }

    // If still not matching, do plain text comparison for legacy data
    if (!isMatch && account.password === password) {
       isMatch = true;
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
