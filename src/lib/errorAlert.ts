import "server-only";
import { createHash } from "crypto";
import nodemailer from "nodemailer";
import { consumeAttempt, type RateLimitOptions } from "@/lib/rateLimit";

/* Emails the site's owner when something breaks that nobody caught.
 *
 * Two callers feed it: `src/instrumentation.ts`, for errors thrown on the
 * server, and `/api/report-error`, for the ones the error boundaries see in a
 * visitor's browser. Before this, both ended in a log line — the server's on
 * Vercel, the browser's on a device nobody here will ever hold — so a fault was
 * found when a trainee mentioned it, if they did.
 *
 * Sent the same way the subscriber emails are: Gmail, `EMAIL_USER` and
 * `EMAIL_PASS`. Without them it logs and returns, exactly as `submit-form` does.
 *
 * It never throws. Reporting a failure must not become a second one — least of
 * all inside `onRequestError`, where Next is already handling the first.
 */

/** Where the alerts go. Not the coach's inbox: these are for whoever fixes it. */
const ALERT_RECIPIENT = "mkm94sports@gmail.com";

/** The name `src/app/layout.tsx` gives the site. Not exported there, so repeated. */
const SITE_NAME = "Ibrahim Abutabikh";

/* One email per distinct error per hour. A fault on the home page is hit by
   every visitor; without this, a hundred visits are a hundred emails and Gmail
   suspends the sending account — taking the subscriber emails down with it. */
const SAME_ERROR_LIMIT: RateLimitOptions = { max: 1, windowMinutes: 60 };

/* And a ceiling across all of them, for the day many different things break at
   once — or for someone feeding `/api/report-error` made-up messages. */
const ALL_ERRORS_LIMIT: RateLimitOptions = { max: 20, windowMinutes: 60 };

/* What each common error name means, for a reader who does not write code.
   Anything missing here is still sent — under its English name, with the
   Arabic line saying it is not one of these. */
const ARABIC_ERROR_NAMES: Record<string, string> = {
  Error: "خطأ عام",
  TypeError: "خطأ في نوع البيانات",
  ReferenceError: "استخدام متغير غير معرّف",
  SyntaxError: "خطأ في صياغة الكود أو البيانات",
  RangeError: "قيمة خارج النطاق المسموح",
  URIError: "رابط غير صالح",
  EvalError: "خطأ في تنفيذ الكود",
  AggregateError: "عدة أخطاء في وقت واحد",
  AbortError: "أُلغيت العملية قبل اكتمالها",
  TimeoutError: "انتهت مهلة العملية",
  ChunkLoadError: "تعذّر تحميل جزء من الموقع",
  PrismaClientKnownRequestError: "خطأ في طلب قاعدة البيانات",
  PrismaClientUnknownRequestError: "خطأ غير معروف في قاعدة البيانات",
  PrismaClientInitializationError: "تعذّر الاتصال بقاعدة البيانات",
  PrismaClientValidationError: "بيانات غير صالحة أُرسلت إلى قاعدة البيانات",
  PrismaClientRustPanicError: "توقف محرك قاعدة البيانات",
  UploadRejected: "رُفض ملف مرفوع من الاستمارة",
  UploadFailed: "فشل رفع ملف من الاستمارة",
  SubmitFailed: "فشل إرسال الاستمارة",
};

export interface ErrorReport {
  /** `error.name`, e.g. "TypeError". */
  name: string;
  message: string;
  stack?: string;
  /** Next's digest — the code the visitor sees on the error screen. */
  digest?: string;
  source: "server" | "browser";
  /** The address that was being requested or shown. */
  path?: string;
  method?: string;
  /** The route file, e.g. /app/dashboard/[id] — server errors only. */
  routePath?: string;
  /** render, route, action or proxy — server errors only. */
  routeType?: string;
  userAgent?: string;
}

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendErrorAlert(report: ErrorReport): Promise<void> {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("[errorAlert] EMAIL_USER or EMAIL_PASS missing. Skipping error alert.");
      return;
    }

    /* "The same error" is the same name and message from the same place. The
       hash keeps the key short whatever the message length. */
    const signature = createHash("sha1")
      .update([report.source, report.name, report.message, report.routePath ?? report.path ?? ""].join("|"))
      .digest("hex")
      .slice(0, 16);

    const same = await consumeAttempt(`error-alert:${signature}`, SAME_ERROR_LIMIT);
    if (!same.allowed) return;
    const all = await consumeAttempt("error-alert:all", ALL_ERRORS_LIMIT);
    if (!all.allowed) return;

    const arabicName = ARABIC_ERROR_NAMES[report.name] ?? "خطأ غير معروف";
    const sourceLabel = report.source === "server" ? "السيرفر" : "متصفح الزائر";

    const rows: Array<[string, unknown]> = [
      ["اسم الموقع", SITE_NAME],
      ["اسم الخطأ (بالإنكليزي)", report.name],
      ["اسم الخطأ (بالعربي)", arabicName],
      ["الخطأ", report.message],
      ["مصدر الخطأ", sourceLabel],
      ["الصفحة", report.path],
      ["الطريقة", report.method],
      ["ملف المسار", report.routePath],
      ["نوع الطلب", report.routeType],
      ["رمز الخطأ (digest)", report.digest],
      ["المتصفح", report.userAgent],
      ["الوقت (UTC)", new Date().toISOString()],
    ];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${SITE_NAME}" <${process.env.EMAIL_USER}>`,
      to: ALERT_RECIPIENT,
      subject: `⚠️ خطأ في موقع ${SITE_NAME} — ${report.name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2 style="color: #DC2626;">حدث خطأ في موقع ${esc(SITE_NAME)}</h2>
          ${rows
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([label, value]) => `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>`)
            .join("")}
          ${report.stack
            ? `<p><strong>تفاصيل مكان الخطأ (stack):</strong></p>
               <pre dir="ltr" style="background: #F1F5F9; padding: 12px; white-space: pre-wrap; font-size: 12px;">${esc(report.stack)}</pre>`
            : ""}
          <p style="color: #64748B; font-size: 12px;">لن تصلك رسالة أخرى عن نفس الخطأ قبل مرور ساعة.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[errorAlert] failed to send error alert:", error);
  }
}
