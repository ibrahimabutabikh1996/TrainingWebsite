"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon, type IconName } from "@/components/Icon";
import { getCategoryBadge } from "@/types/diet";
import { formatDate } from "@/lib/trainingDates";
import "./analytics.css";

export type CountRow = { name: string; count: number; color?: string };

export type AnalyticsData = {
  players: {
    total: number;
    active: number;
    expired: number;
    suspended: number;
    notActivated: number;
    expiringSoon: number;
    renewalPending: number;
    noCourse: number;
    noDiet: number;
    joinedThisMonth: number;
  };
  monthly: { label: string; count: number }[];
  plans: CountRow[];
  training: {
    last7: number;
    last30: number;
    activeTrainees30: number;
    completedCycles: number;
    completedCycles30: number;
    daily: { label: string; count: number }[];
    top: { id: string; name: string; count: number }[];
    idle: { id: string; name: string; days: number; lastOn: string | null }[];
    idleTotal: number;
    idleDays: number;
  };
  library: {
    courses: number;
    exercises: number;
    topCourses: CountRow[];
    muscles: CountRow[];
  };
  diet: {
    templates: number;
    prescribed: number;
    traineesWithDiet: number;
    foods: number;
    categories: CountRow[];
  };
  staff: {
    coach: { courses: number; dietPlans: number };
    members: { name: string; isSuspended: boolean; trainees: number; courses: number; dietPlans: number }[];
  };
};

type Tone = "primary" | "success" | "warning" | "error" | "muted";

/* The icon tile's tone. Muted has no tone class: its tile stays unlit. */
const TILE_TONE: Record<Tone, string> = {
  primary: "ui-icon-tile--lit",
  success: "ui-icon-tile--lit tone-success",
  warning: "ui-icon-tile--lit tone-warning",
  error: "ui-icon-tile--lit tone-danger",
  muted: "",
};

function Stat({ icon, label, value, tone = "primary", hint }: { icon: IconName; label: string; value: number; tone?: Tone; hint?: string }) {
  return (
    <div className={`an-stat an-tone-${tone}`}>
      <span className={`an-stat-icon ui-icon-tile ${TILE_TONE[tone]}`}>
        <Icon name={icon} />
      </span>
      <div className="an-stat-body">
        <span className="an-stat-value">{value}</span>
        <span className="an-stat-label">{label}</span>
        {hint && <span className="an-stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section className="an-section">
      <h2 className="an-section-title">
        <Icon name={icon} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`an-card ${wide ? "an-card--wide" : ""}`}>
      <h3 className="an-card-title">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="an-empty">{text}</p>;
}

/* A ranked list drawn as bars. HTML rather than a chart: the names are Arabic
   and often long, and a row of text with a bar under it wraps and reads right
   to left where an SVG axis would clip it. */
function BarList({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="an-bars">
      {rows.map((row) => (
        <li key={row.name} className="an-bar-row">
          <div className="an-bar-head">
            <span className="an-bar-name">{row.name}</span>
            <span className="an-bar-count">{row.count}</span>
          </div>
          <div className="an-bar-track">
            <div
              className="an-bar-fill"
              style={{ width: `${(row.count / max) * 100}%`, ...(row.color ? { ["--bar-color" as string]: row.color } : {}) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* The chart's own tooltip, in the panel's glass instead of recharts' white box. */
function ChartTip({ active, payload, label, unit }: { active?: boolean; payload?: { value?: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tip">
      <span className="an-tip-label">{label}</span>
      <span className="an-tip-value">
        {payload[0].value ?? 0} {unit}
      </span>
    </div>
  );
}

export default function AnalyticsClient({ data }: { data: AnalyticsData | null }) {
  if (!data) {
    return (
      <div className="an-page">
        <header className="an-header">
          <h1>التحليلات</h1>
        </header>
        <div className="an-card">
          <Empty text="تعذّر تحميل التحليلات الآن. حدّث الصفحة بعد قليل." />
        </div>
      </div>
    );
  }

  const { players, training, library, diet, staff } = data;
  const monthlyTotal = data.monthly.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="an-page">
      <header className="an-header">
        <h1>التحليلات</h1>
        <p className="an-lead">صورة كاملة عن المشتركين والتزامهم والمكتبة، محسوبة من بيانات الموقع الحالية.</p>
      </header>

      {/* ── Players ── */}
      <Section icon="group" title="اللاعبين">
        <div className="an-stats">
          <Stat icon="group" label="إجمالي المشتركين" value={players.total} hint={`${players.joinedThisMonth} انضموا هذا الشهر`} />
          <Stat icon="check_circle" label="اشتراك فعّال" value={players.active} tone="success" />
          <Stat icon="hourglass" label="ينتهي خلال 7 أيام" value={players.expiringSoon} tone="warning" />
          <Stat icon="history" label="منتهي الاشتراك" value={players.expired} tone="error" />
          <Stat icon="block" label="موقوف" value={players.suspended} tone="muted" />
          <Stat icon="schedule" label="بانتظار التفعيل" value={players.notActivated} tone="muted" />
          <Stat icon="restore" label="طلبات تجديد معلقة" value={players.renewalPending} tone="warning" />
        </div>

        <div className="an-grid">
          <Card title="المشتركين الجدد شهرياً" wide>
            {monthlyTotal === 0 ? (
              <Empty text="لا يوجد مشتركين جدد خلال آخر 12 شهر." />
            ) : (
              <div className="an-chart" dir="ltr">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid vertical={false} stroke="var(--glass-border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "var(--text-muted)" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)" }} />
                    <Tooltip cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} content={<ChartTip unit="مشترك" />} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="توزيع المشتركين على الخطط">
            <BarList rows={data.plans} empty="لا يوجد مشتركين بعد." />
          </Card>

          <Card title="قيد التجهيز">
            <p className="an-card-note">مشتركين فعّالين خطتهم تشمل هذا الجزء ولم يُجهَّز لهم بعد.</p>
            <div className="an-mini-stats">
              <Stat icon="fitness_center" label="بدون برنامج تدريبي" value={players.noCourse} tone={players.noCourse ? "warning" : "success"} />
              <Stat icon="restaurant_menu" label="بدون نظام غذائي" value={players.noDiet} tone={players.noDiet ? "warning" : "success"} />
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Training commitment ── */}
      <Section icon="activity" title="الالتزام بالتمرين">
        <div className="an-stats">
          <Stat icon="event_available" label="تمارين آخر 7 أيام" value={training.last7} />
          <Stat icon="calendar_month" label="تمارين آخر 30 يوم" value={training.last30} />
          <Stat icon="person" label="متدربين تمرنوا خلال 30 يوم" value={training.activeTrainees30} tone="success" />
          <Stat
            icon="emoji_events"
            label="دورات تدريبية مكتملة"
            value={training.completedCycles}
            hint={`${training.completedCycles30} خلال آخر 30 يوم`}
          />
        </div>

        <div className="an-grid">
          <Card title="التمارين المسجلة يومياً — آخر 30 يوم" wide>
            {training.last30 === 0 ? (
              <Empty text="لم يُسجَّل أي تمرين خلال آخر 30 يوم." />
            ) : (
              <div className="an-chart" dir="ltr">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={training.daily} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="an-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--glass-border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} tick={{ fill: "var(--text-muted)" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)" }} />
                    <Tooltip cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3 }} content={<ChartTip unit="تمرين" />} />
                    <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fill="url(#an-area-fill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="الأكثر التزاماً — آخر 30 يوم">
            {training.top.length === 0 ? (
              <Empty text="لا يوجد تمارين مسجلة بعد." />
            ) : (
              <ol className="an-people">
                {training.top.map((t, i) => (
                  <li key={t.id}>
                    <Link href={`/admin/profile/${t.id}`} className="an-person">
                      <span className="an-rank">{i + 1}</span>
                      <span className="an-person-name">{t.name}</span>
                      <span className="an-person-meta">{t.count} تمرين</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title={`منقطعين عن التمرين (${training.idleDays} يوم أو أكثر)`}>
            {training.idle.length === 0 ? (
              <Empty text="كل المشتركين الفعّالين يتمرنون بانتظام." />
            ) : (
              <>
                <ul className="an-people">
                  {training.idle.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/profile/${t.id}`} className="an-person">
                        <span className="an-person-name">{t.name}</span>
                        <span className="an-person-meta is-warning">
                          {t.lastOn ? `آخر تمرين ${formatDate(t.lastOn)}` : "لم يتمرن بعد"} · {t.days} يوم
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {training.idleTotal > training.idle.length && (
                  <p className="an-card-note">و{training.idleTotal - training.idle.length} غيرهم.</p>
                )}
              </>
            )}
          </Card>
        </div>
      </Section>

      {/* ── Courses and exercises ── */}
      <Section icon="fitness_center" title="التمارين والبرامج">
        <div className="an-stats">
          <Stat icon="library_books" label="كورس بالمكتبة" value={library.courses} />
          <Stat icon="biceps_flexed" label="تمرين بالمكتبة" value={library.exercises} />
        </div>
        <div className="an-grid">
          <Card title="الكورسات الأكثر استخداماً">
            <BarList rows={library.topCourses} empty="لم يُسند أي كورس لمشترك بعد." />
          </Card>
          <Card title="التمارين حسب العضلة">
            <BarList rows={library.muscles} empty="مكتبة التمارين فارغة." />
          </Card>
        </div>
      </Section>

      {/* ── Diet ── */}
      <Section icon="restaurant_menu" title="الأنظمة الغذائية">
        <div className="an-stats">
          <Stat icon="inventory_2" label="قالب بمكتبة الأنظمة" value={diet.templates} />
          <Stat icon="receipt_long" label="نظام مخصص لمشترك" value={diet.prescribed} />
          <Stat icon="person" label="مشترك عنده نظام غذائي" value={diet.traineesWithDiet} tone="success" />
          <Stat icon="nutrition" label="مصدر غذائي" value={diet.foods} />
        </div>
        <div className="an-grid">
          <Card title="المصادر الغذائية حسب الصنف">
            <BarList
              rows={diet.categories.map((c) => ({ ...c, color: getCategoryBadge(c.name).color }))}
              empty="مكتبة المصادر الغذائية فارغة."
            />
          </Card>
        </div>
      </Section>

      {/* ── Administration ── */}
      <Section icon="verified_user" title="الإدارة">
        <div className="an-card">
          <h3 className="an-card-title">من سوّى شنو</h3>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th scope="col">الاسم</th>
                  <th scope="col">المشتركين</th>
                  <th scope="col">الكورسات</th>
                  <th scope="col">الأنظمة الغذائية</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">المدرب</th>
                  <td>الكل</td>
                  <td>{staff.coach.courses}</td>
                  <td>{staff.coach.dietPlans}</td>
                </tr>
                {staff.members.map((m) => (
                  <tr key={m.name} className={m.isSuspended ? "is-suspended" : ""}>
                    <th scope="row">
                      {m.name}
                      {m.isSuspended && <span className="an-badge">موقوف</span>}
                    </th>
                    <td>{m.trainees}</td>
                    <td>{m.courses}</td>
                    <td>{m.dietPlans}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staff.members.length === 0 && <p className="an-card-note">لا يوجد مشرفين بعد.</p>}
        </div>
      </Section>
    </div>
  );
}
