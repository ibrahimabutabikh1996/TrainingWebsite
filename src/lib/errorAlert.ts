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

/* Which copy of the site raised it. The alerts used to read the same whether a
   visitor hit the live site or the owner's own `npm run dev` cancelled a page
   mid-load — "The destination stream closed early" from localhost looked as
   alarming as a broken checkout. Read on the server that sends the email, which
   is also the one the visitor was talking to. */
function environmentLabel(): string {
  if (process.env.NODE_ENV !== "production") return "سيرفر التطوير على جهازك (ليس الموقع الحقيقي)";
  if (process.env.VERCEL_ENV === "production") return "الموقع المنشور (الحقيقي)";
  if (process.env.VERCEL_ENV === "preview") return "نسخة معاينة على Vercel (ليست الموقع الحقيقي)";
  return "نسخة إنتاج خارج Vercel (مثل npm run start على جهازك)";
}

interface Explanation {
  meaning: string;
  action: string;
}

/* What the error means and whether anything needs doing, for the ones that
   actually arrive. Matched on name and message together; first match wins, so
   the specific entries sit above the general ones. Anything unmatched still
   gets a line saying so, rather than a silent gap. */
function explainError(report: ErrorReport, dev: boolean): Explanation {
  const { name, message } = report;
  const has = (pattern: RegExp) => pattern.test(message);

  if (has(/destination stream closed early/i)) {
    return {
      meaning: "المتصفح أوقف تحميل الصفحة قبل أن يكتمل — انتقال لصفحة أخرى، أو إعادة تحميل، أو إغلاق التبويب.",
      action: "لا شيء عادةً، الزائر لم يرَ خطأ. إن تكرر كثيراً على الموقع المنشور فهو يستحق المراجعة.",
    };
  }
  if (name === "SubmitFailed" && has(/missing required field|قيمة غير صحيحة|يرجى تعبئة/)) {
    return {
      meaning: "رفض السيرفر الاستمارة لأن حقلاً إجبارياً وصل فارغاً أو بقيمة غير صحيحة، وقيل للزائر اسم الحقل.",
      action: "لا شيء إن كان مرة واحدة. إن تكرر مع نفس الحقل فالصفحة لا تفحص ذلك الحقل قبل الانتقال، ويحتاج إصلاحاً.",
    };
  }
  if (name === "SubmitFailed") {
    return {
      meaning: "لم تُحفظ استمارة زائر.",
      action: "راجع «الخطأ» أعلاه. إن كان الزائر قد دفع فتواصل معه، فاستمارته لم تصل.",
    };
  }
  if (name === "UploadRejected" || name === "UploadFailed") {
    return {
      meaning: "لم يُرفع ملف اختاره الزائر في الاستمارة، وقد قيل له ذلك.",
      action: "إن كان السبب نوع الملف أو حجمه فلا شيء. إن كان خطأ في التخزين وتكرر فيحتاج مراجعة.",
    };
  }
  if (name === "ChunkLoadError" || has(/Loading chunk|dynamically imported module|Importing a module script failed/i)) {
    return {
      meaning: "المتصفح كان يفتح نسخة قديمة من الموقع بعد نشر تحديث جديد، فلم يجد جزءاً منها.",
      action: "لا شيء عادةً، إعادة تحميل الصفحة تحلها.",
    };
  }
  if (has(/^(Failed to fetch|Load failed|NetworkError)/i)) {
    return {
      meaning: "انقطع اتصال الزائر بالإنترنت أثناء الطلب.",
      action: "لا شيء، المشكلة في شبكة الزائر.",
    };
  }
  if (has(/Hydration failed|did not match|hydrat/i)) {
    return {
      meaning: "ما رسمه السيرفر للصفحة يختلف عمّا رسمه متصفح الزائر.",
      action: "يحتاج مراجعة إن تكرر — الصفحة قد تظهر بشكل خاطئ أو لا تستجيب.",
    };
  }
  if (name === "ReferenceError" || has(/is not defined/)) {
    return {
      meaning: "الكود يستخدم اسماً غير موجود — خطأ برمجي، والجزء الذي ظهر فيه من الصفحة توقف.",
      action: dev
        ? "غالباً حدث أثناء تعديل ملف قبل اكتمال التعديل. إن اختفى بعد الحفظ فلا شيء."
        : "يحتاج إصلاحاً: الصفحة معطّلة عند الزائر.",
    };
  }
  if (name === "TypeError" && has(/Cannot read propert|undefined|null/)) {
    return {
      meaning: "الكود حاول قراءة بيانات غير موجودة — غالباً قيمة فارغة لم يتوقعها.",
      action: "يحتاج إصلاحاً إن تكرر. «الصفحة» و«تفاصيل مكان الخطأ» تحددان أين.",
    };
  }
  if (name.startsWith("PrismaClientInitialization") || has(/Can't reach database|connection pool|ECONNREFUSED/i)) {
    return {
      meaning: "تعذّر الاتصال بقاعدة البيانات.",
      action: "عاجل إن كان على الموقع المنشور — تحقق من قاعدة البيانات ومن متغيرات البيئة.",
    };
  }
  if (name.startsWith("Prisma")) {
    return {
      meaning: "قاعدة البيانات رفضت طلباً من الموقع.",
      action: "يحتاج مراجعة: «الخطأ» أعلاه يحدد الجدول أو الحقل.",
    };
  }
  return {
    meaning: "لا يوجد شرح جاهز لهذا الخطأ.",
    action: "راجع «الخطأ» و«تفاصيل مكان الخطأ» أدناه، أو أرسل الرسالة كما هي للمطوّر.",
  };
}

/* The user-agent string, read for a person. The raw one stays in the email
   below this, for anything the summary leaves out. */
function describeDevice(ua?: string): string | undefined {
  if (!ua) return undefined;
  const parts: string[] = [];

  const ios = /\b(iPhone|iPad|iPod)\b.*? OS (\d+)(?:_(\d+))?/.exec(ua);
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua);
  if (ios) parts.push(`${ios[1] === "iPad" ? "آيباد" : "آيفون"} — iOS ${ios[2]}${ios[3] ? `.${ios[3]}` : ""}`);
  else if (android) parts.push(`أندرويد ${android[1]}`);
  else if (/Windows NT/.test(ua)) parts.push("ويندوز");
  else if (/Mac OS X/.test(ua)) parts.push("ماك");
  else if (/Linux/.test(ua)) parts.push("لينكس");

  /* The in-app browsers first: a visitor coming from an Instagram link is told
     apart from one in Safari only here, and those browsers behave differently. */
  const inApp: Array<[RegExp, string]> = [
    [/Instagram/, "Instagram"],
    [/FBAN|FBAV|FB_IAB/, "Facebook"],
    [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
    [/Snapchat/, "Snapchat"],
  ];
  const app = inApp.find(([pattern]) => pattern.test(ua));
  if (app) {
    parts.push(`من داخل تطبيق ${app[1]}`);
  } else {
    const browsers: Array<[RegExp, string]> = [
      [/Edg(?:A|iOS)?\/(\d+)/, "Edge"],
      [/OPR\/(\d+)/, "Opera"],
      [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
      [/CriOS\/(\d+)/, "Chrome"],
      [/FxiOS\/(\d+)/, "Firefox"],
      [/Firefox\/(\d+)/, "Firefox"],
      [/Chrome\/(\d+)/, "Chrome"],
      [/Version\/(\d+(?:\.\d+)?).*Safari/, "Safari"],
    ];
    for (const [pattern, browserName] of browsers) {
      const match = pattern.exec(ua);
      if (match) {
        parts.push(`${browserName} ${match[1]}`);
        break;
      }
    }
  }

  return parts.length ? parts.join(" — ") : undefined;
}

/* The owner's clock. UTC stays in the email as well, for matching against logs. */
function localTime(at: Date): string {
  return at.toLocaleString("sv-SE", { timeZone: "Asia/Baghdad", hour12: false });
}

/* Which deployment was live. Only Vercel sets these, so a local run shows none. */
function deployedVersion(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) return undefined;
  const subject = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  return subject ? `${sha.slice(0, 7)} — ${subject}` : sha.slice(0, 7);
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
    const dev = process.env.NODE_ENV !== "production";
    const explanation = explainError(report, dev);
    const now = new Date();

    const rows: Array<[string, unknown]> = [
      ["اسم الموقع", SITE_NAME],
      ["البيئة", environmentLabel()],
      ["اسم الخطأ (بالإنكليزي)", report.name],
      ["اسم الخطأ (بالعربي)", arabicName],
      ["الخطأ", report.message],
      ["الشرح", explanation.meaning],
      ["ماذا تفعل", explanation.action],
      ["مصدر الخطأ", sourceLabel],
      ["الصفحة", report.path],
      ["الطريقة", report.method],
      ["ملف المسار", report.routePath],
      ["نوع الطلب", report.routeType],
      ["رمز الخطأ (digest)", report.digest],
      ["الجهاز", describeDevice(report.userAgent)],
      ["المتصفح", report.userAgent],
      ["نسخة الكود المنشورة", deployedVersion()],
      ["الوقت (بغداد)", localTime(now)],
      ["الوقت (UTC)", now.toISOString()],
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
