import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { validateSubmission } from "./validate";
import { hashPassword } from "@/lib/auth";
import { getSession, requireUser, sessionOwnsProfile } from "@/lib/authGuard";
import { readIntakeData, withoutCredentials } from "@/lib/intakeData";
import { attachSessionItems, confirmedPathsFor, openSession } from "@/lib/uploadSessions";
import {
  clientAddress,
  consumeAttempt,
  SUBMIT_FORM_LIMIT,
  SUBMIT_FORM_RENEWAL_LIMIT,
  SUBMIT_FORM_SESSION_LIMIT,
} from "@/lib/rateLimit";
import { resolvePlanNames, planNameFrom } from "@/lib/planNames";
import { currentMonthData, withCarriedFields } from "@/lib/subscriptionMonths";
import { getLandingContent } from "@/app/admin/cms/actions";
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
     * because filling this form takes minutes and nobody submits it six times.
     *
     * This address ceiling is no longer the whole story. `clientAddress` reads a
     * header the caller writes, and rotating it was shown to walk through this
     * limit and the two upload ones. A second key is consumed further down, once
     * the request has said which of the two operations it is and that claim has
     * been checked — see `secondKeyRefusal`. Both have to allow it. */
    const address = clientAddress(request);
    const byAddress = await consumeAttempt(`submit-form:${address}`, SUBMIT_FORM_LIMIT);

    /* Held rather than returned on. The second key is not known yet, and
       refusing here would mean the address ceiling is still the only one an
       attacker has to get past. Answered together, below. */
    const tooMany = (retryAfterSeconds: number) =>
      NextResponse.json(
        { error: "محاولات كثيرة جداً — انتظر قليلاً ثم أعد المحاولة" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );

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
    /* Kept for the anonymous half of this handler: registration has no session
       by definition, and `openSession` below takes whatever there is — null
       included — to decide whether an upload session may be spent. */
    const viewer = await getSession();

    if (profileId) {
      /* `requireUser` rather than the bare `viewer` above.
       *
       * A signed cookie only proves what was true when it was minted, and this
       * branch is the one that matters financially. Reading the session without
       * `requireUser` skipped `sessionRefusal`, so neither of the two things
       * that can stop being true was checked: a trainee the coach had suspended
       * kept renewing, and a token issued before a password change — the case a
       * password change exists to shut out — went on working here after it had
       * been refused everywhere else. The other endpoints have gone through
       * this guard all along; this one took the weaker read because it also
       * serves anonymous callers, and gave the anonymous rule to everybody. */
      const auth = await requireUser();
      if (!auth.ok) return auth.response;

      if (!(await sessionOwnsProfile(auth.session, profileId))) {
        return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
      }

      /* The renewal's second key. The profile is server-derived — the session
         was verified and ownership checked on the two lines above — so it is not
         something the caller can rotate the way an address can. Consumed only
         after those checks, or naming somebody else's profile would spend their
         allowance for them. */
      const byProfile = await consumeAttempt(
        `submit-form:profile:${profileId}`,
        SUBMIT_FORM_RENEWAL_LIMIT
      );
      if (!byAddress.allowed || !byProfile.allowed) {
        return tooMany(Math.max(byAddress.retryAfterSeconds, byProfile.retryAfterSeconds));
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

      /* The registration's second key.
       *
       * An anonymous caller has no account to count against — but it does have
       * this, and the session id was minted by this server, not chosen by the
       * sender. `openSession` has just accepted it, so counting it here cannot
       * spend a stranger's allowance either.
       *
       * The renewal branch has already taken its own key against the profile,
       * so this only applies to the anonymous path. */
      if (!profileId) {
        const bySession = await consumeAttempt(
          `submit-form:session:${opened.session.id}`,
          SUBMIT_FORM_SESSION_LIMIT
        );
        if (!byAddress.allowed || !bySession.allowed) {
          return tooMany(Math.max(byAddress.retryAfterSeconds, bySession.retryAfterSeconds));
        }
      }

      uploadedFiles = await confirmedPathsFor(opened.session.id, keepItemIds);
    }

    /* A submission that named no upload session took the address key above and
       never had it enforced, because the branches that answer on it both need a
       second key that this shape does not have. It cannot succeed — the receipt
       gate below refuses it — but "cannot succeed" is not "costs nothing", and
       leaving it unchecked means a rotated address can run the parse and the
       whole validator for free. */
    if (!byAddress.allowed) {
      return tooMany(byAddress.retryAfterSeconds);
    }

    /* The form opens on a payment gate: the fee is settled over WhatsApp and the
       transfer slip attached before the first question. The gate only disables a
       button, which is a courtesy and not a guarantee — this is the check that
       decides whether an unpaid submission may be recorded.

       Renewals are held to it too now. They used to be exempt, on the reasoning
       that a renewing trainee is "already a paying member" — but a renewal is a
       new month and therefore a new transfer, and the slip for it is the only
       thing the coach has to look at. Note what this check is and is not: it
       proves a file was attached, never that money arrived. Nothing in this
       system can prove that — there is no gateway and no webhook, the transfer
       happens over WhatsApp, and the receipt is an image a visitor chose. The
       proof is the coach opening it. That is why neither branch below grants a
       single day of subscription. */
    if ((uploadedFiles.payment_receipt?.length ?? 0) === 0) {
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
    /* `let`, because the renewal branch replaces it with the same answers plus
       the bookkeeping carried over from the profile being renewed. */
    let finalData: Record<string, unknown> = {
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

    /* Filled in by the renewal branch, and read by the notification at the end
       of the handler. The coach's message used to name the trainee and nothing
       else, which is not enough to act on: it did not say which month was being
       asked for, nor which account to open. Both are known here — one is
       computed from `renewals`, the other lives in `accounts` — and neither
       reaches the stored blob. */
    let renewalMonthNumber: number | null = null;
    let traineeUsername: string | null = null;

    if (profileId) {
      // It's a renewal
      const existingProfile = await prisma.profiles.findUnique({
        where: { id: profileId },
        /* The sign-in name, for the coach's notification only. It is never
           written back into the blob — `withoutCredentials` exists to keep it
           out of there — and it is read from `accounts`, which is the one place
           that holds it. */
        include: { accounts: { select: { username: true } } },
      });

      /* Read through the same filter: a renewal copies the previous answers
         into `history` wholesale, so a password stored by an older version of
         this route would otherwise be carried forward into a snapshot and
         outlive the cleanup. */
      const existingData: JsonRecord = readIntakeData(existingProfile?.data);

      /* One pending request at a time.
       *
       * Nothing stopped a trainee sending this form again while the coach had
       * not yet looked at the last one, and every send pushed another entry
       * into `history` — so an anxious person tapping the button five times
       * gave themselves five months of subscription history that never
       * happened, and the coach five notifications for one payment. The rate
       * limiter above is a ceiling on how *fast*, which is a different
       * question from how *many*.
       *
       * Refused rather than merged, because the two submissions may differ and
       * the coach has already been told about the first. The way out is the
       * coach's: approving the request clears the flag, and so does rejecting
       * it — see `rejectRenewalAction`. A trainee is never stuck waiting on a
       * flag only they can see. */
      if (existingData.renewal_pending === true) {
        return NextResponse.json(
          { error: "لديك طلب تجديد قيد المراجعة بالفعل — يرجى انتظار موافقة الكابتن" },
          { status: 409 }
        );
      }

      const history = existingData.history || [];

      const renewals = existingData.renewals || [];
      const currentMonthNumber = renewals.length + 1;
      const nextMonthNumber = renewals.length + 2;

      renewalMonthNumber = nextMonthNumber;
      traineeUsername = existingProfile?.accounts?.username ?? null;

      /* The closing month is archived as the answers it was lived under, and
         nothing else.
       *
       * This used to copy the blob wholesale with only `history` taken back
       * out, which left `renewals` and `weightLogs` inside every snapshot. Both
       * grow for the life of the subscription, so month five archived four
       * months of weigh-ins that month four had already archived three of: the
       * stored row grew with the square of the months, and by month twelve it
       * was 25 KB of which 23 were repeats. `currentMonthData` keeps the
       * answers and drops the bookkeeping the app writes around them — all of
       * which lives at the top level, where it is read from. */
      history.push({
        label: currentMonthNumber === 1 ? 'الشهر الأول' : `الشهر ${currentMonthNumber}`,
        date: new Date().toISOString(),
        data: currentMonthData(existingData)
      });

      /* `renewals` is deliberately carried over untouched rather than pushed to.
       *
       * That list is the record of months actually granted — the panel counts it
       * as "التفعيلات" and the timeline draws one row per entry. Pushing here
       * recorded a grant at the moment the trainee asked for one, which is the
       * same mistake as the subscription date below: it let the request award
       * itself. It also double-counted, because /api/admin/renew-account pushes
       * its own entry when the coach approves — so an honest renewal that went
       * through both paths showed up as two months.
       *
       * The entry is written on approval, and only there. */
      /* Everything the app had accumulated about this trainee, carried across
       * the renewal rather than dropped.
       *
       * `finalData` is built from the answers that were just submitted, so
       * anything the profile held that is not an answer was simply gone the
       * moment the update ran. `renewals` and `history` were rescued by hand,
       * just above; the rest were not, and the loss was silent — a renewal
       * emptied the trainee's entire weigh-in log, moved the date their first
       * month is measured from, and un-hid every month the coach had hidden.
       *
       * `existingData` is the stored row and `jsonData` is a string the
       * submitter chose; `withCarriedFields` only ever reads the first. See
       * there for why that direction is the security of it. */
      finalData = withCarriedFields(finalData, existingData);

      finalData.renewals = renewals;
      finalData.history = history;
      finalData.is_renewal = true;

      /* What the trainee submitted is a *request*. Nothing here grants a day.
       *
       * The coach reads the attached slip and decides — that review is the only
       * payment verification this system has, and it happens after this handler
       * returns. `renewal_pending` is what the panel keys the pending state off,
       * and /api/admin/renew-account clears it when the coach approves.
       *
       * Stored as flags on the existing `profiles.data` jsonb blob, alongside
       * `is_new` and `is_renewal`, which is where every other flag of this kind
       * already lives — no column, no migration. */
      finalData.renewal_pending = true;
      finalData.renewal_requested_at = new Date().toISOString();
      /* `nextMonthNumber` is the label the approval will use; kept so the panel
         can say which month is being asked for while it is still pending. */
      finalData.renewal_requested_month = nextMonthNumber;

      profile = await prisma.$transaction(async (tx) => {
        const updated = await tx.profiles.update({
          where: { id: profileId },
          data: {
            username: fullname || existingProfile?.username || "مستخدم غير معروف",
            data: finalData as Prisma.InputJsonObject,
            /* `subscription_ends_at` is deliberately absent.
             *
             * It used to be set to `subscriptionEndFrom()` right here, so
             * submitting the form restarted the period on the spot: thirty days,
             * granted by the request itself. Nothing had verified a payment,
             * because nothing in this system can — the transfer happens over
             * WhatsApp and the "receipt" is an image the submitter chose. Any
             * trainee could re-send this form each month and never pay again.
             *
             * Granting the period is the coach's, through
             * /api/admin/renew-account, after they have opened the slip. This
             * row now carries `renewal_pending` and waits for that. Leaving the
             * column alone also means a renewal asked for mid-period cannot
             * shorten a subscription that still has days left on it. */
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

        /* Was a three-armed ternary with the plan names written out again — a
           third copy of the six names, with no arm for the offers, so a
           subscriber who came through that section put the raw key "offer2" in
           the coach's email. It reads the panel now, like the card the person
           clicked and the form they filled in. */
        const planNames = resolvePlanNames(
          (await getLandingContent())?.content_ar as JsonRecord | undefined
        );
        const planName = planNameFrom(planNames, jsonData.plan, String(jsonData.plan ?? ""));

        /* The trainee's answers go into an HTML document. They were interpolated
           raw, so a name containing a tag was markup by the time the coach read
           it — the submitter writing part of the page the coach opens. Nothing
           here needs to carry formatting, so all of it is text. */
        const esc = (value: unknown) =>
          String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        const monthLabel = renewalMonthNumber ? `الشهر ${renewalMonthNumber}` : null;

        /* Says what happened, to whom, and for which month — the three things
           the coach needs before opening the panel. The old subject named the
           trainee and stopped there, so two renewals a month apart were
           indistinguishable in an inbox. */
        const subject = profileId
          ? `طلب تجديد اشتراك: ${jsonData.fullname}${monthLabel ? ` — ${monthLabel}` : ""}`
          : `مشترك جديد: ${jsonData.fullname}`;

        await transporter.sendMail({
          from: `"Ibrahim Abutabikh" <${process.env.EMAIL_USER}>`,
          to: "ibrahim1996.im@gmail.com",
          subject,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2 style="color: #2563EB;">${profileId ? 'طلب تجديد اشتراك' : 'تسجيل مشترك جديد'}</h2>
              ${profileId
                ? `<p>قام المتدرب <strong>${esc(jsonData.fullname)}</strong> بطلب تجديد اشتراكه بالخطة <strong>${esc(planName)}</strong>${monthLabel ? ` — <strong>${esc(monthLabel)}</strong>` : ""}.</p>`
                : ""}
              <p><strong>الاسم:</strong> ${esc(jsonData.fullname)}</p>
              ${profileId && traineeUsername ? `<p><strong>اسم المستخدم:</strong> ${esc(traineeUsername)}</p>` : ""}
              ${profileId && monthLabel ? `<p><strong>الشهر المطلوب:</strong> ${esc(monthLabel)}</p>` : ""}
              <p><strong>الخطة المطلوبة:</strong> ${esc(planName)}</p>
              <p><strong>رقم الهاتف:</strong> ${esc(jsonData.phone || jsonData.mobile || 'غير محدد')}</p>
              <p><strong>العمر:</strong> ${esc(jsonData.age)}</p>
              <p><strong>وصل الدفع:</strong> مرفق — يُراجع من لوحة التحكم</p>
              <br/>
              ${profileId
                ? `<p>الطلب <strong>بانتظار موافقتك</strong>: افتح ملف المتدرب من لوحة التحكم، راجع الوصل وبيانات الشهر الجديد، ثم اضغط "موافقة وتجديد" لتُضاف الأيام.</p>`
                : `<p>يرجى الدخول للوحة التحكم لمشاهدة التفاصيل كاملة.</p>`}
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

