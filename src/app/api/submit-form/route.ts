import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { validateSubmission } from "./validate";
import { hashPassword } from "@/lib/auth";
import { getSession, sessionOwnsProfile } from "@/lib/authGuard";
import { readIntakeData, withoutCredentials } from "@/lib/intakeData";
import { attachSessionItems, confirmedPathsFor, openSession } from "@/lib/uploadSessions";
import { clientAddress, consumeAttempt, SUBMIT_FORM_LIMIT } from "@/lib/rateLimit";
import { subscriptionEndFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";

export const dynamic = "force-dynamic";


/* The submission is JSON now, not multipart.
 *
 * The files reached Supabase directly from the browser before this runs — see
 * `@/lib/uploadSessions`. What arrives here is the answers plus an upload
 * session id, so the request is a few kilobytes whatever was attached to it.
 * That is what gets past Vercel's ~4.5 MB body limit, which a single phone photo
 * could already exceed.
 */
export async function POST(request: Request) {
  try {
    /* The one public write endpoint, and the only one that had no ceiling.
     *
     * Every other anonymous path already counts: /api/auth/login by address and
     * by username, /api/uploads/session and /api/uploads/create by address. This
     * one creates an `accounts` row, a `profiles` row and sends a mail, and would
     * do it as fast as the network allowed — enough to fill the table, exhaust
     * the mail credentials and bury the coach's real registrations.
     *
     * Counted before the body is read, so a refused caller costs nothing but the
     * counter itself. The window matches the sign-in one; the allowance is lower
     * because filling this form takes minutes and nobody submits it six times. */
    const address = clientAddress(request);
    const limit = await consumeAttempt(`submit-form:${address}`, SUBMIT_FORM_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "محاولات كثيرة جداً — انتظر قليلاً ثم أعد المحاولة" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    let body: {
      data?: unknown;
      profileId?: unknown;
      uploadSessionId?: unknown;
      keepItemIds?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "صيغة البيانات غير صحيحة" }, { status: 400 });
    }

    const dataString = typeof body.data === "string" ? body.data : null;
    const profileId = typeof body.profileId === "string" && body.profileId ? body.profileId : null;
    const uploadSessionId =
      typeof body.uploadSessionId === "string" && body.uploadSessionId ? body.uploadSessionId : null;
    /* Which of the session's confirmed files the form still wants — the person
       may have removed one after it uploaded. Narrowing only; see
       `confirmedPathsFor`. */
    const keepItemIds = Array.isArray(body.keepItemIds)
      ? body.keepItemIds.filter((id): id is string => typeof id === "string").slice(0, 100)
      : undefined;

    if (!dataString) {
      return NextResponse.json({ error: "البيانات مفقودة" }, { status: 400 });
    }

    /* Two different operations share this handler.
     *
     * Registration is open — a stranger filling in the intake form is the whole
     * point of it. Renewal is not: it overwrites a profile in place, pushes the
     * previous answers into `history` and restarts the subscription period. It
     * took the profile id straight from the request body and did as it was told,
     * so anyone could overwrite any trainee's record and hand them — or
     * themselves — thirty fresh days. The renewal path now has to be the owner
     * of that profile, or the coach. */
    const viewer = await getSession();

    if (profileId) {
      if (!viewer) {
        return NextResponse.json({ error: "يجب تسجيل الدخول لتجديد الاشتراك" }, { status: 401 });
      }
      if (!(await sessionOwnsProfile(viewer, profileId))) {
        return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
      }
    }

    let jsonData: Record<string, unknown>;
    try {
      jsonData = JSON.parse(dataString);
    } catch {
      return NextResponse.json({ error: "صيغة البيانات غير صحيحة" }, { status: 400 });
    }

    /* Reject drifted or malformed submissions here rather than storing them in
       the jsonb blob, where a wrong field name surfaces only as a blank cell in
       the admin panel weeks later. */
    const validation = validateSubmission(jsonData);
    if (!validation.ok) {
      console.error("Rejected form submission:", validation.errors);
      return NextResponse.json(
        { error: "بيانات الاستمارة غير صالحة", details: validation.errors },
        { status: 400 }
      );
    }

    /* The attachments, read from the upload session rather than from the request.
     *
     * Only rows the server itself confirmed are here: an object that was
     * uploaded but failed verification, or was never confirmed at all, is not
     * part of the submission and will be swept. The client cannot add to this
     * list — it has no say in which paths exist or which field they belong to. */
    let uploadedFiles: Record<string, string[]> = {};

    if (uploadSessionId) {
      const opened = await openSession(uploadSessionId, viewer);
      if (!opened.ok) {
        return NextResponse.json({ error: opened.error }, { status: opened.status });
      }

      /* A renewal session belongs to one profile and may only be spent on it;
         a registration session belongs to none and may not be spent on an
         existing profile at all. */
      const scope = opened.session.scope;
      if (profileId) {
        if (scope !== "renewal" || opened.session.profile_id !== profileId) {
          return NextResponse.json({ error: "جلسة الرفع لا تخصّ هذا الاشتراك" }, { status: 403 });
        }
      } else if (scope !== "registration") {
        return NextResponse.json({ error: "جلسة الرفع لا تخصّ هذا الطلب" }, { status: 403 });
      }

      uploadedFiles = await confirmedPathsFor(opened.session.id, keepItemIds);
    }

    /* The form now opens on a payment gate: the fee is settled over WhatsApp and
       the transfer slip attached before the first question. The gate only
       disables a button, which is a courtesy and not a guarantee — this is the
       check that decides whether an unpaid registration may be recorded.
       Renewals never see that gate and are not held to it. */
    if (!profileId && (uploadedFiles.payment_receipt?.length ?? 0) === 0) {
      return NextResponse.json(
        { error: "يجب إرفاق وصل الدفع قبل إرسال الاستمارة", details: ["missing required field: payment_receipt"] },
        { status: 400 }
      );
    }

    if (jsonData.gender === "male" && (uploadedFiles.body_photos?.length ?? 0) === 0) {
      return NextResponse.json(
        { error: "بيانات الاستمارة غير صالحة", details: ["missing required field: body_photos"] },
        { status: 400 }
      );
    }

    /* Validated above, so fullname is present and a string. */
    const fullname = String(jsonData.fullname ?? "").trim();

    /* Combine all data.
     *
     * The credentials come back out before anything is stored: `rawPassword`
     * below hashes into `accounts`, which is the only copy that should exist.
     * Spreading `jsonData` wholesale left a second, plain-text copy sitting in
     * this jsonb column, from where it travelled to the dashboard as
     * `raw_answers` and to the coach's panel in full. */
    const finalData: Record<string, unknown> = {
      ...withoutCredentials(jsonData),
      ...uploadedFiles,
      is_new: true, // For admin notifications
    };

    /* The profile write and the attachment of its files commit together.
     *
     * Storage and Postgres are two systems and cannot share a transaction, so
     * the bytes are already in the bucket by now whatever happens next. What can
     * be made atomic is the pair that matters: the profile that references the
     * paths, and the rows that mark those paths as spoken for. Split apart, a
     * failure between them either leaves a record pointing at files the sweep
     * thinks are abandoned, or files nothing points at. Together, a failure
     * leaves confirmed-but-unattached objects, which is exactly what the sweep
     * is for. */
    let profile;

    if (profileId) {
      // It's a renewal
      const existingProfile = await prisma.profiles.findUnique({
        where: { id: profileId }
      });

      /* Read through the same filter: a renewal copies the previous answers
         into `history` wholesale, so a password stored by an older version of
         this route would otherwise be carried forward into a snapshot and
         outlive the cleanup. */
      const existingData: JsonRecord = readIntakeData(existingProfile?.data);

      const history = existingData.history || [];
      const dataWithoutHistory = { ...existingData };
      delete dataWithoutHistory.history;
      
      const renewals = existingData.renewals || [];
      const currentMonthNumber = renewals.length + 1;
      const nextMonthNumber = renewals.length + 2;

      // Save previous state to history
      history.push({
        label: currentMonthNumber === 1 ? 'الشهر الأول' : `الشهر ${currentMonthNumber}`,
        date: new Date().toISOString(),
        data: dataWithoutHistory
      });

      renewals.push({
        date: new Date().toISOString(),
        label: `الشهر ${nextMonthNumber}`
      });

      finalData.renewals = renewals;
      finalData.history = history;
      finalData.is_renewal = true;

      profile = await prisma.$transaction(async (tx) => {
        const updated = await tx.profiles.update({
          where: { id: profileId },
          data: {
            username: fullname || existingProfile?.username || "مستخدم غير معروف",
            data: finalData as Prisma.InputJsonObject,
            // Submitting the renewal form restarts the subscription period.
            subscription_ends_at: subscriptionEndFrom()
          }
        });
        if (uploadSessionId) {
          await attachSessionItems(tx, uploadSessionId, updated.id, keepItemIds);
        }
        return updated;
      });
    } else {
      const rawUsername = String(jsonData.username || "").trim();
      const rawPassword = String(jsonData.password || "").trim();

      /* Checked here so the common case gets the sentence that tells the person
         what to do about it. It is not the guarantee — see the catch below. */
      if (rawUsername && rawPassword) {
        const existingAccount = await prisma.accounts.findUnique({ where: { username: rawUsername } });
        if (existingAccount) {
          return NextResponse.json({ error: "اسم المستخدم محجوز، يرجى اختيار اسم آخر" }, { status: 400 });
        }
      }

      const hashedPassword = rawUsername && rawPassword ? await hashPassword(rawPassword) : null;

      try {
        profile = await prisma.$transaction(async (tx) => {
          let accountId: string | undefined;

          if (hashedPassword) {
            const newAccount = await tx.accounts.create({
              data: { username: rawUsername, password: hashedPassword },
            });
            accountId = newAccount.id;
          }

          const created = await tx.profiles.create({
            data: {
              username: fullname || "مستخدم غير معروف",
              user_id: accountId,
              data: finalData as Prisma.InputJsonObject,
            },
          });

          if (uploadSessionId) {
            await attachSessionItems(tx, uploadSessionId, created.id, keepItemIds);
          }
          return created;
        });
      } catch (error) {
        /* The look-up above and this insert are two statements, so two people
           submitting the same name at the same time both pass the check and the
           second one reaches the unique index. `accounts.username` being unique
           is what actually prevents the duplicate; without this it surfaced as
           the outer handler's 500 — "حدث خطأ" for something the person could
           have fixed by typing a different name. */
        if ((error as { code?: string })?.code === "P2002") {
          return NextResponse.json(
            { error: "اسم المستخدم محجوز، يرجى اختيار اسم آخر" },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // Send Email via Nodemailer
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const planName = jsonData.plan === "plan1" ? "خطة ذاتية التوجيه" :
                         jsonData.plan === "plan2" ? "خطة المتابعة الأسبوعية" :
                         jsonData.plan === "plan3" ? "خطة المتابعة اليومية" : jsonData.plan;

        await transporter.sendMail({
          from: `"Ibrahim Abutabikh" <${process.env.EMAIL_USER}>`,
          to: "ibrahim1996.im@gmail.com",
          subject: profileId ? `طلب تجديد اشتراك: ${jsonData.fullname}` : `مشترك جديد: ${jsonData.fullname}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2 style="color: #2563EB;">${profileId ? 'طلب تجديد اشتراك' : 'تسجيل مشترك جديد'}</h2>
              <p><strong>الاسم:</strong> ${jsonData.fullname}</p>
              <p><strong>الخطة المطلوبة:</strong> ${planName}</p>
              <p><strong>رقم الهاتف:</strong> ${jsonData.phone || jsonData.mobile || 'غير محدد'}</p>
              <p><strong>العمر:</strong> ${jsonData.age}</p>
              ${profileId ? "" : `<p><strong>وصل الدفع:</strong> مرفق — يُراجع من لوحة التحكم</p>`}
              <br/>
              <p>يرجى الدخول للوحة التحكم لمشاهدة التفاصيل كاملة.</p>
            </div>
          `,
        });
      } else {
        console.warn("EMAIL_USER or EMAIL_PASS missing in .env. Skipping email notification.");
      }
    } catch (emailErr) {
      console.error("Failed to send email notification:", emailErr);
      // We don't fail the submission if email fails
    }

    return NextResponse.json({ success: true, profileId: profile.id });
  } catch (error) {
    /* The detail goes to the log, not to the response.
     *
     * This used to hand `error.message` back to the caller, and this is the one
     * endpoint on the site that anyone can reach without signing in. A Prisma
     * failure names the model, the column and the constraint it tripped on; a
     * connection failure names the host. None of that is something a
     * registration form should teach a stranger, and none of it helps the person
     * actually filling it in — the validation errors they can act on are
     * returned above, with their own 400. */
    console.error("Submit form error:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

