import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { credentialError, hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { requireAdmin } from "@/lib/authGuard";
import { normalizePermissions } from "@/lib/staffPermissions";

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* Managing staff — the coach only, on every verb. No `need` is passed to
   `requireAdmin`, so no grant a staff member holds can reach this: otherwise one
   of them could hand themselves, or a friend, the rest of the panel. */

const FORBIDDEN_TARGET = { error: "المشرف غير موجود" };

/** Creates a staff account: a username, a password and a grant. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { username, password, permissions } = await request.json();

    /* The same rule every account in the app is made under — see `@/lib/auth`.
       It also refuses the coach's own names. */
    const credentialProblem = credentialError(username, password);
    if (credentialProblem) {
      return NextResponse.json({ error: credentialProblem }, { status: 400 });
    }

    /* Lowercased for the reason /api/admin/create-account gives: sign-in looks
       the name up on a case-sensitive column. */
    const cleanUsername = (username as string).toLowerCase();
    const hashedPassword = await hashPassword(password as string);

    const account = await prisma.accounts.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        staff_accounts: { create: { permissions: normalizePermissions(permissions) } },
      },
      select: { id: true, username: true },
    });

    return NextResponse.json({ success: true, accountId: account.id, username: account.username });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "اسم المستخدم موجود مسبقاً، يرجى اختيار اسم آخر" },
        { status: 400 }
      );
    }
    console.error("Create staff API Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء المشرف" }, { status: 500 });
  }
}

/**
 * Changes a staff member: any of their grant, their suspension, their password.
 *
 * The grant and the suspension apply from the staff member's next request —
 * the guards read both on every one. A new password also signs them out, by
 * the same `password_changed_at` stamp every other reset uses.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { accountId, permissions, isSuspended, password } = await request.json();

    if (typeof accountId !== "string" || !isValidUUID(accountId)) {
      return NextResponse.json(FORBIDDEN_TARGET, { status: 404 });
    }

    /* Only ever a staff row: this endpoint must not become a way to change a
       trainee's or the coach's account. */
    const staff = await prisma.staff_accounts.findUnique({
      where: { account_id: accountId },
      select: { account_id: true },
    });
    if (!staff) return NextResponse.json(FORBIDDEN_TARGET, { status: 404 });

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} خانات على الأقل` },
          { status: 400 }
        );
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `كلمة المرور يجب ألا تتجاوز ${MAX_PASSWORD_LENGTH} خانة` },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (permissions !== undefined || typeof isSuspended === "boolean") {
        await tx.staff_accounts.update({
          where: { account_id: accountId },
          data: {
            ...(permissions !== undefined ? { permissions: normalizePermissions(permissions) } : {}),
            ...(typeof isSuspended === "boolean" ? { is_suspended: isSuspended } : {}),
          },
        });
      }
      if (typeof password === "string") {
        await tx.accounts.update({
          where: { id: accountId },
          data: { password: await hashPassword(password), password_changed_at: new Date() },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update staff API Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حفظ التعديلات" }, { status: 500 });
  }
}

/**
 * Deletes a staff account.
 *
 * Courses they wrote are not deleted with them: `courses.coach_id` names the
 * account that created each one, so those are handed to the coach first —
 * trainees may be following them.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const accountId = new URL(request.url).searchParams.get("id");
    if (!accountId || !isValidUUID(accountId)) {
      return NextResponse.json(FORBIDDEN_TARGET, { status: 404 });
    }

    const staff = await prisma.staff_accounts.findUnique({
      where: { account_id: accountId },
      select: { account_id: true },
    });
    if (!staff) return NextResponse.json(FORBIDDEN_TARGET, { status: 404 });

    await prisma.$transaction([
      prisma.courses.updateMany({
        where: { coach_id: accountId },
        data: { coach_id: auth.session.userId },
      }),
      prisma.accounts.delete({ where: { id: accountId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete staff API Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء حذف المشرف" }, { status: 500 });
  }
}
