import Link from "next/link";
import {
  AlertTriangle, BookOpen, CalendarClock, ChevronLeft, Dumbbell, Globe, Hourglass, RefreshCw,
  Salad, ShoppingBag, Store, TrendingUp, UserPlus, Users, UtensilsCrossed,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import { isMissingTable } from "@/lib/store/catalog";
import { formatIQD } from "@/lib/store/types";
import { SUBSCRIPTION_DAYS, daysRemaining, isSubscriptionExpired } from "@/lib/subscription";
import { DAY_MS, formatShortDate, toISODate } from "@/lib/trainingDates";
import type { JsonRecord } from "@/types";
import "./overview.css";

export const dynamic = "force-dynamic";

/* The coach's front page: where things stand today and what needs doing.
 *
 * The coach's alone — no permission is passed to the guard, the same rule as
 * Analytics, since it reads every trainee and the store's takings. Every figure
 * is counted the way the Analytics screen counts it (active = activated, not
 * suspended, not expired; idle = a course to follow and nothing recorded for
 * IDLE_DAYS), so the two screens never disagree. */

const IDLE_DAYS = 14;
const LIST_MAX = 5;

/* A card's tone, as the system's tone class on its icon tile. Primary needs
   none; muted has none, and its tile is left unlit. */
const TILE_TONE: Record<string, string> = {
  primary: "",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
  muted: "",
};

function readBlob(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

type Person = { id: string; name: string; note: string; sort?: number };

interface StoreSnapshot {
  newOrders: number;
  monthSales: number;
  lowStock: number;
}

async function storeSnapshot(monthStart: Date): Promise<StoreSnapshot | null> {
  try {
    const [newOrders, sales, products] = await Promise.all([
      prisma.store_orders.count({ where: { status: "new" } }),
      prisma.store_orders.aggregate({
        _sum: { total: true },
        where: { status: { in: ["confirmed", "delivered"] }, created_at: { gte: monthStart } },
      }),
      prisma.store_products.findMany({ where: { stock: { not: null } }, select: { stock: true, low_stock_threshold: true } }),
    ]);
    return {
      newOrders,
      monthSales: sales._sum.total ?? 0,
      lowStock: products.filter((p) => (p.stock ?? 0) <= p.low_stock_threshold).length,
    };
  } catch (error) {
    if (!isMissingTable(error)) console.error("[overview] Failed to read the store:", error);
    return null;
  }
}

export default async function AdminOverviewPage() {
  await requireAdminPage();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysAgo = (n: number) => new Date(today.getTime() - n * DAY_MS);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  let failed = false;
  const counts = { active: 0, expiringSoon: 0, renewalPending: 0, joinedThisMonth: 0, total: 0 };
  const renewals: Person[] = [];
  const expiring: Person[] = [];
  const unprepared: Person[] = [];
  const idle: Person[] = [];
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = toISODate(daysAgo(6 - i));
    return { iso, label: formatShortDate(iso), count: 0 };
  });
  let weekTotal = 0;
  let weekTrainees = 0;

  const store = await storeSnapshot(monthStart);

  try {
    const [profiles, lastWorkouts, dietTrainees, sessions] = await Promise.all([
      /* Five keys of the intake blob, picked in Postgres — the whole record is
         every measurement and each renewal's copy of it. */
      prisma.$queryRaw<
        Array<{
          id: string;
          username: string;
          created_at: Date;
          is_suspended: boolean;
          subscription_ends_at: Date | null;
          current_course_id: string | null;
          data: unknown;
        }>
      >`
        SELECT
          p.id,
          COALESCE(a.username, p.username) AS username,
          p.created_at,
          p.is_suspended,
          p.subscription_ends_at,
          p.current_course_id,
          CASE
            WHEN jsonb_typeof(p.data) = 'object' THEN jsonb_build_object(
              'fullname', p.data -> 'fullname',
              'plan_type', p.data -> 'plan_type',
              'renewal_pending', p.data -> 'renewal_pending',
              'activation_date', p.data -> 'activation_date'
            )
            ELSE p.data
          END AS data
        FROM public.profiles p
        LEFT JOIN public.accounts a ON a.id = p.user_id
      `,
      prisma.$queryRaw<Array<{ profile_id: string; last_on: Date }>>`
        SELECT c.profile_id, MAX(s.performed_on) AS last_on
        FROM public.training_sessions s
        JOIN public.training_cycles c ON c.id = s.cycle_id
        WHERE s.performed_on IS NOT NULL
        GROUP BY c.profile_id
      `,
      prisma.diet_plans.findMany({ where: { profile_id: { not: null } }, select: { profile_id: true } }),
      prisma.training_sessions.findMany({
        where: { performed_on: { gte: daysAgo(6) } },
        select: { performed_on: true, training_cycles: { select: { profile_id: true } } },
      }),
    ]);

    const withDiet = new Set(dietTrainees.map((d) => d.profile_id as string));
    const lastOf = new Map(lastWorkouts.map((r) => [r.profile_id, r.last_on]));
    counts.total = profiles.length;

    for (const p of profiles) {
      const blob = readBlob(p.data);
      const name = (typeof blob.fullname === "string" && blob.fullname.trim()) || p.username;
      if (p.created_at >= monthStart) counts.joinedThisMonth += 1;
      if (blob.renewal_pending === true) {
        counts.renewalPending += 1;
        renewals.push({ id: p.id, name, note: "طلب تجديد بانتظار الموافقة" });
      }
      /* Most trainees have no stored end date. The account card the coach
         opens (AccountManager) and the trainee's own dashboard read that as
         thirty days from activation, or from sign-up when there is no
         activation date; read it the same way here, or this page calls them
         all inactive while their cards say active. */
      const endsAt =
        p.subscription_ends_at ??
        new Date(new Date(typeof blob.activation_date === "string" ? blob.activation_date : p.created_at).getTime() + SUBSCRIPTION_DAYS * DAY_MS);
      if (p.is_suspended || Number.isNaN(endsAt.getTime()) || isSubscriptionExpired(endsAt, now)) continue;

      counts.active += 1;
      const left = daysRemaining(endsAt, now);
      if (left !== null && left <= 7) {
        counts.expiringSoon += 1;
        expiring.push({ id: p.id, name, sort: left, note: left <= 0 ? "ينتهي اليوم" : left === 1 ? "باقي يوم واحد" : `باقي ${left} أيام` });
      }

      const planType = String(blob.plan_type ?? "both");
      const missing = [
        planType !== "diet" && !p.current_course_id ? "كورس" : null,
        planType !== "training" && !withDiet.has(p.id) ? "نظام غذائي" : null,
      ].filter(Boolean);
      if (missing.length) unprepared.push({ id: p.id, name, note: `بدون ${missing.join(" و")}` });

      if (p.current_course_id) {
        const last = lastOf.get(p.id) ?? null;
        const since = last ?? new Date(endsAt.getTime() - SUBSCRIPTION_DAYS * DAY_MS);
        const days = Math.floor((today.getTime() - since.getTime()) / DAY_MS);
        if (days >= IDLE_DAYS) idle.push({ id: p.id, name, sort: -days, note: last ? `آخر تمرين قبل ${days} يوم` : "لم يسجّل أي تمرين" });
      }
    }

    expiring.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    idle.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const byDay = new Map(week.map((d, i) => [d.iso, i]));
    const trainees = new Set<string>();
    for (const s of sessions) {
      if (!s.performed_on) continue;
      const i = byDay.get(toISODate(s.performed_on));
      if (i === undefined) continue;
      week[i].count += 1;
      weekTotal += 1;
      trainees.add(s.training_cycles.profile_id);
    }
    weekTrainees = trainees.size;
  } catch (error) {
    failed = true;
    console.error("[overview] Failed to build the overview:", error);
  }

  const peak = Math.max(1, ...week.map((d) => d.count));
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Baghdad" }).format(now));
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  const dateLine = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Baghdad" }).format(now);

  const stats = [
    { label: "مشترك فعّال", value: counts.active, icon: Users, tone: "primary", href: "/admin" },
    { label: "ينتهي خلال 7 أيام", value: counts.expiringSoon, icon: Hourglass, tone: counts.expiringSoon ? "warning" : "muted", href: "/admin" },
    { label: "طلبات تجديد", value: counts.renewalPending, icon: RefreshCw, tone: counts.renewalPending ? "danger" : "muted", href: "/admin" },
    { label: "جديد هذا الشهر", value: counts.joinedThisMonth, icon: UserPlus, tone: "success", href: "/admin" },
  ];

  const attention = [
    { title: "طلبات التجديد", icon: RefreshCw, tone: "danger", people: renewals, empty: "لا توجد طلبات معلّقة" },
    { title: "اشتراكات تنتهي قريباً", icon: CalendarClock, tone: "warning", people: expiring, empty: "لا شيء ينتهي هذا الأسبوع" },
    { title: "بانتظار التجهيز", icon: AlertTriangle, tone: "primary", people: unprepared, empty: "كل المشتركين لديهم برامجهم" },
    { title: `متوقفون عن التمرين (${IDLE_DAYS}+ يوم)`, icon: Dumbbell, tone: "muted", people: idle, empty: "الجميع يتمرّن 💪" },
  ];

  const actions = [
    { label: "المشتركين", href: "/admin", icon: Users },
    { label: "صانع الكورسات", href: "/admin/builder", icon: BookOpen },
    { label: "النظام الغذائي", href: "/admin/diet", icon: UtensilsCrossed },
    { label: "مكتبة الأنظمة", href: "/admin/diet/library", icon: Salad },
    { label: "محتوى الموقع", href: "/admin/cms", icon: Globe },
    { label: "التحليلات", href: "/admin/analytics", icon: TrendingUp },
  ];

  return (
    <div className="ov-page" dir="rtl">
      <header className="ov-head">
        <div>
          <p className="ov-date">{dateLine}</p>
          <h1>{greeting} كابتن 👋</h1>
          <p className="ov-sub">
            {failed ? "تعذّر تحميل بعض الأرقام — حاول تحديث الصفحة." : `${counts.total} مشترك مسجّل، ${counts.active} منهم فعّال الآن.`}
          </p>
        </div>
      </header>

      <div className="ov-stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`admin-card ov-stat ov-tone--${s.tone}`}>
            <span className={`ov-stat-icon ui-icon-tile ${s.tone === "muted" ? "" : "ui-icon-tile--lit"} ${TILE_TONE[s.tone]}`}><s.icon aria-hidden="true" /></span>
            <strong className="ov-stat-value">{s.value}</strong>
            <span className="ov-stat-label">{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="ov-grid">
        <section className="ov-attention" aria-label="يحتاج انتباهك">
          <h2 className="ov-title">يحتاج انتباهك</h2>
          <div className="ov-lists">
            {attention.map((group) => (
              <article key={group.title} className={`admin-card ov-list ov-tone--${group.tone}`}>
                <header>
                  <span className={`ov-list-icon ui-icon-tile ui-icon-tile--sm ${TILE_TONE[group.tone]}`}><group.icon aria-hidden="true" /></span>
                  <h3>{group.title}</h3>
                  <span className="ov-count">{group.people.length}</span>
                </header>
                {group.people.length === 0 ? (
                  <p className="ov-empty">{group.empty}</p>
                ) : (
                  <ul>
                    {group.people.slice(0, LIST_MAX).map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/profile/${p.id}`}>
                          <span className="ov-avatar" aria-hidden="true">{p.name.trim().charAt(0)}</span>
                          <span className="ov-person">
                            <strong>{p.name}</strong>
                            <small>{p.note}</small>
                          </span>
                          <ChevronLeft aria-hidden="true" className="ov-chev" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {group.people.length > LIST_MAX && (
                  <Link href="/admin" className="ov-more">و{group.people.length - LIST_MAX} آخرين — عرض المشتركين</Link>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="ov-side">
          <section className="admin-card ov-panel">
            <header className="ov-panel-head">
              <h2>التمارين هذا الأسبوع</h2>
              <Link href="/admin/analytics" className="ov-link">التحليلات <ChevronLeft aria-hidden="true" /></Link>
            </header>
            <p className="ov-week-total">
              <strong>{weekTotal}</strong> تمرين مسجّل من <strong>{weekTrainees}</strong> مشترك
            </p>
            <ol className="ov-chart" aria-label="عدد التمارين لكل يوم">
              {week.map((d) => (
                <li key={d.iso} title={`${d.label}: ${d.count}`}>
                  <span className="ov-bar-value">{d.count || ""}</span>
                  <span className="ov-bar" style={{ height: `${Math.max(4, (d.count / peak) * 100)}%` }} />
                  <span className="ov-bar-label">{d.label}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="admin-card ov-panel ov-store">
            <header className="ov-panel-head">
              <h2><ShoppingBag aria-hidden="true" /> المتجر</h2>
              <Link href="/admin/store" className="ov-link">لوحة المتجر <ChevronLeft aria-hidden="true" /></Link>
            </header>
            {store ? (
              <div className="ov-store-figures">
                <Link href="/admin/store/orders"><strong>{store.newOrders}</strong><span>طلبات جديدة</span></Link>
                <Link href="/admin/store/orders"><strong>{formatIQD(store.monthSales)}</strong><span>مبيعات الشهر</span></Link>
                <Link href="/admin/store/inventory"><strong>{store.lowStock}</strong><span>منتجات قاربت على النفاد</span></Link>
              </div>
            ) : (
              <p className="ov-empty">يبدأ عرض الطلبات والمبيعات بعد تشغيل ملفات قاعدة بيانات المتجر.</p>
            )}
            <Link href="/store" target="_blank" className="ov-store-open"><Store aria-hidden="true" /> فتح المتجر</Link>
          </section>

          <section className="admin-card ov-panel">
            <h2 className="ov-panel-title">اختصارات</h2>
            <div className="ov-actions">
              {actions.map((a) => (
                <Link key={a.href} href={a.href} className="ov-action">
                  <a.icon aria-hidden="true" />
                  <span>{a.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
