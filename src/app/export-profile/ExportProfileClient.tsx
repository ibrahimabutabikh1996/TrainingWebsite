"use client";

import React from "react";
import { Icon } from "@/components/Icon";
import type { JsonRecord, MonthlyArchive } from "@/types";
import { answerLabel, answerList } from "@/lib/formLabels";
import { formatTimestamp } from "@/lib/trainingDates";

interface Props {
  traineeName: string;
  regDate: string;
  gender?: string;
  plan: string;
  goal: string;
  age: string;
  weight: string;
  height: string;
  activity: string;
  allergies: string;
  healthIssues: string;
  dislikedFood: string;
  workoutLocation: string;
  sleepHours: string;
  waterIntake: string;
  stressLevel: string;
  experience: string;
  /* Body measurements, read straight out of the intake blob — the values are
     whatever the form wrote, so numbers arrive as numbers or as strings. */
  measurements: Record<string, string | number | null | undefined>;
  monthlyHistory: MonthlyArchive[];
  /* The rest of the intake answers, read by key. JsonRecord is the project's
     one documented escape hatch for a blob whose shape the form decides. */
  raw?: JsonRecord;
}

export default function ExportProfileClient({
  traineeName,
  regDate,
  gender = "male",
  plan,
  goal,
  age,
  weight,
  height,
  activity,
  allergies,
  healthIssues,
  dislikedFood,
  workoutLocation,
  sleepHours,
  waterIntake,
  stressLevel,
  experience,
  measurements = {},
  monthlyHistory = [],
  raw = {},
}: Props) {
  const mArm = measurements?.arm || measurements?.bicep || "—";
  const mWaist = measurements?.waist || "—";
  const mThigh = measurements?.thigh || "—";
  const mChest = measurements?.chest || "—";
  const mShoulders = measurements?.shoulders || "—";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F2ED",
        color: "#050505",
        fontFamily: "'Cairo', 'Baloo 2', sans-serif",
        direction: "rtl",
        padding: "40px 20px",
      }}
    >
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0;
            padding: 0;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Action Toolbar - Hidden on Print */}
      <div
        className="no-print"
        style={{
          maxWidth: "960px",
          margin: "0 auto 24px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          /* The report sheet keeps its own printed palette; the toolbar is app
             UI and follows the document, not the retired brand. */
          background: "#FFFFFF",
          padding: "16px 24px",
          borderRadius: "16px",
          color: "#050505",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Icon name="description" style={{ color: "#96701A", fontSize: "30px" }} />
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#050505", fontWeight: 800 }}>
              التقرير الشامل والأرشيف الرياضي (جاهز للطباعة والتحميل)
            </h3>
            <span style={{ fontSize: "0.85rem", color: "#524F4B" }}>
              اختر &quot;Save as PDF&quot; في نافذة الطباعة لحفظ التقرير كملف PDF معتمد للطرفين
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => window.print()}
            style={{
              background: "#96701A",
              color: "#FFFFFF",
              border: "none",
              padding: "12px 26px",
              borderRadius: "12px",
              fontSize: "1.05rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="file_download" style={{ fontSize: "22px" }} />
            <span>طباعة / حفظ PDF</span>
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: "transparent",
              color: "#524F4B",
              border: "1px solid rgba(0,0,0,0.15)",
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* A4 Printable Document Sheet */}
      <div
        className="print-sheet"
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          background: "#FFFFFF",
          padding: "52px",
          borderRadius: "20px",
          boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {/* Header Branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "3px solid #96701A",
            paddingBottom: "24px",
            marginBottom: "32px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, background: "rgba(150,112,26,0.15)", color: "#96701A", padding: "4px 12px", borderRadius: "20px", display: "inline-block", marginBottom: "10px" }}>
              وثيقة معتمدة من إدارة التدريب
            </span>
            <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#050505", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>
              تقرير الملف الشخصي والأرشيف التراكمي
            </h1>
            <p style={{ margin: 0, fontSize: "1.1rem", color: "#524F4B", fontWeight: 700 }}>
              الكابتن إبراهيم — متابعة التطور البدني والقياسات الشاملة
            </p>
          </div>
          <div style={{ textAlign: "left", fontSize: "0.92rem", color: "#524F4B", background: "#F5F2ED", padding: "14px 20px", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: "#96701A", fontSize: "1.2rem", marginBottom: "4px" }}>IBRAHIM GYM</div>
            <div>تاريخ الإصدار: {formatTimestamp(new Date())}</div>
            <div>تاريخ التسجيل بالرحلة: {regDate}</div>
            <div style={{ fontWeight: 700, color: "#050505", marginTop: "4px" }}>إجمالي الأشهر: {monthlyHistory.length || 1} أشهر</div>
          </div>
        </div>

        {/* Section 1: Demographics & Physical Stats */}
        <div style={{ marginBottom: "36px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📌</span>
            <span>البيانات الشخصية والمؤشرات البدنية الأساسية</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>الاسم الكامل</div>
              <div style={{ fontSize: "1.15rem", color: "#050505", fontWeight: 800 }}>{traineeName}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>الخطة التدريبية</div>
              <div style={{ fontSize: "1.1rem", color: "#96701A", fontWeight: 800 }}>{plan}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>الهدف الرياضي المعتمد</div>
              <div style={{ fontSize: "1.05rem", color: "#050505", fontWeight: 800 }}>{goal}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>العمر</div>
              <div style={{ fontSize: "1.1rem", color: "#050505", fontWeight: 800 }}>{age}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>الوزن المعتمد</div>
              <div style={{ fontSize: "1.1rem", color: "#050505", fontWeight: 800 }}>{weight}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>الطول</div>
              <div style={{ fontSize: "1.1rem", color: "#050505", fontWeight: 800 }}>{height}</div>
            </div>
            <div style={{ background: "#F5F2ED", padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "0.78rem", color: "#524F4B", fontWeight: 700 }}>النشاط اليومي</div>
              <div style={{ fontSize: "1.05rem", color: "#050505", fontWeight: 800 }}>{activity}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Body Measurements (Females only) */}
        {gender === "female" && (
          <div style={{ marginBottom: "36px" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>⚖️</span>
              <span>القياسات الجسدية ومحيطات العضلات</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", background: "#F5F2ED", padding: "20px", borderRadius: "16px", border: "1px solid rgba(150,112,26,0.15)" }}>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(0,0,0,0.08)", paddingLeft: "8px" }}>
                <div style={{ fontSize: "0.8rem", color: "#524F4B", fontWeight: 700 }}>محيط الذراع</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#050505", marginTop: "4px" }}>{mArm}</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(0,0,0,0.08)", paddingLeft: "8px" }}>
                <div style={{ fontSize: "0.8rem", color: "#524F4B", fontWeight: 700 }}>محيط الخصر</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#050505", marginTop: "4px" }}>{mWaist}</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(0,0,0,0.08)", paddingLeft: "8px" }}>
                <div style={{ fontSize: "0.8rem", color: "#524F4B", fontWeight: 700 }}>محيط الفخذ</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#050505", marginTop: "4px" }}>{mThigh}</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(0,0,0,0.08)", paddingLeft: "8px" }}>
                <div style={{ fontSize: "0.8rem", color: "#524F4B", fontWeight: 700 }}>محيط الصدر</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#050505", marginTop: "4px" }}>{mChest}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.8rem", color: "#524F4B", fontWeight: 700 }}>محيط الأكتاف</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#050505", marginTop: "4px" }}>{mShoulders}</div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Comprehensive Questionnaire & Lifestyle Answers */}
        <div style={{ marginBottom: "40px", display: "flex", flexDirection: "column", gap: "28px" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🍽️</span>
              <span>مواعيد الوجبات المفضلة وأيام الالتزام</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>فطور أيام العمل:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.workday_breakfast, "غير محدد")}</div>
              </div>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>غداء أيام العمل:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.workday_lunch, "غير محدد")}</div>
              </div>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>عشاء أيام العمل:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.workday_dinner, "غير محدد")}</div>
              </div>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>فطور العطل والإجازات:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.holiday_breakfast, "غير محدد")}</div>
              </div>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>غداء العطل والإجازات:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.holiday_lunch, "غير محدد")}</div>
              </div>
              <div style={{ padding: "14px", background: "#F5F2ED", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.82rem", marginBottom: "4px" }}>عشاء العطل والإجازات:</div>
                <div style={{ color: "#050505", fontWeight: 800, fontSize: "1rem" }}>{answerLabel(raw.holiday_dinner, "غير محدد")}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🥗</span>
              <span>التفضيلات الغذائية والعادات اليومية</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)", gridColumn: "1 / -1" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>الأكلات المفضلة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.fav_foods || "لم يذكر"}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#d97706", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>الحساسية الغذائية أو الموانع:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{allergies}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>أنواع اللحوم المفضلة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{answerList(raw.meat, "عام")}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>معدل القهوة اليومي:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{answerLabel(raw.coffee_rate, "طبيعي")}{raw.coffee_type ? ` (${raw.coffee_type})` : ""}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>الرغبة في شراء المكملات:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{answerLabel(raw.buy_supp, "غير محدد")}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🏋️‍♂️</span>
              <span>الالتزام الرياضي وخبرة التمرين</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>مكان التمرين المختار:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{workoutLocation}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>الخبرة الرياضية السابقة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{experience}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>أنواع التمارين السابقة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{answerList(raw.workout_type_exp, "عام")}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>أيام التمرين الأسبوعية المعتمدة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{sleepHours}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>مواعيد وفترات التدريب:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{waterIntake}</div>
              </div>
              {raw.workout_type_other_desc && (
                <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)", gridColumn: "1 / -1" }}>
                  <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>ملاحظات أو رياضات أخرى:</div>
                  <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.workout_type_other_desc}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🩺</span>
              <span>الملف الصحي وتاريخ التغذية والدايت</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#d97706", fontWeight: 800, fontSize: "0.95rem", marginBottom: "4px" }}>المشاكل الصحية أو الإصابات السابقة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{healthIssues}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>المكملات الغذائية المستخدمة حالياً:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.supplements_list || "لا يوجد"}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 700, fontSize: "0.9rem", marginBottom: "4px" }}>تجارب وأنظمة الدايت السابقة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.diet_history || "لا يوجد"}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>سبب فشل أو تعثر الدايت الأخير:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.last_diet_fail || "لا يوجد"}</div>
              </div>
              {/* Both of these are read from the intake answers in page.tsx and
                  handed down as props, but no card printed them — so the sheet
                  quietly dropped two of the trainee's answers. */}
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>الأطعمة المفضلة أو غير المرغوبة:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{dislikedFood}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>مستوى التوتر والضغط النفسي:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{stressLevel}</div>
              </div>
              <div style={{ padding: "16px", background: "#F5F2ED", borderRadius: "14px", border: "1px solid rgba(0,0,0,0.05)", gridColumn: "1 / -1" }}>
                <div style={{ color: "#524F4B", fontWeight: 800, fontSize: "0.9rem", marginBottom: "4px" }}>أسباب ودوافع تناول الطعام:</div>
                <div style={{ color: "#050505", fontWeight: 700, fontSize: "1.05rem" }}>{raw.eating_reason || "لا يوجد"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Monthly Subscription History Table */}
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#050505", borderBottom: "2px solid rgba(0,0,0,0.08)", paddingBottom: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📅</span>
            <span>سجل وأرشيف الأشهر التراكمية (البرامج التدريبية والغذائية)</span>
          </h2>

          {monthlyHistory.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#524F4B" }}>
              لا يوجد أرشيف شهري مسجل بعد.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", marginTop: "10px" }}>
              <thead>
                <tr style={{ background: "#050505", color: "#E8C96A", fontSize: "0.95rem" }}>
                  <th style={{ padding: "14px 16px", borderTopRightRadius: "12px" }}>الشهر</th>
                  <th style={{ padding: "14px 16px" }}>الفترة الزمنية</th>
                  <th style={{ padding: "14px 16px" }}>النظام التدريبي</th>
                  <th style={{ padding: "14px 16px" }}>النظام الغذائي</th>
                  <th style={{ padding: "14px 16px", borderTopLeftRadius: "12px" }}>حالة الجدول</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHistory.map((row, idx) => {
                  const isCurrent = row.status === "current";
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? "#FFFFFF" : "#F5F2ED",
                        borderBottom: "1px solid rgba(0,0,0,0.08)",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                      }}
                    >
                      <td style={{ padding: "16px", fontWeight: 800, color: "#050505" }}>
                        {row.monthName}
                      </td>
                      <td style={{ padding: "16px", color: "#524F4B", fontSize: "0.9rem" }}>
                        من {row.startDate} إلى {row.endDate}
                      </td>
                      <td style={{ padding: "16px", color: "#050505" }}>
                        {row.workout?.courseName || "جدول تمارين الكابتن"} ({row.workout?.daysCount ?? 0} أيام)
                      </td>
                      <td style={{ padding: "16px", color: "#96701A", fontWeight: 700 }}>
                        {row.diet?.name || "نظام مخصص"}
                      </td>
                      <td style={{ padding: "16px" }}>
                        {isCurrent ? (
                          <span style={{ color: "#96701A", background: "rgba(150,112,26,0.15)", padding: "4px 10px", borderRadius: "12px", fontWeight: 800, fontSize: "0.82rem" }}>
                            ★ الشهر الحالي (نشط)
                          </span>
                        ) : (
                          <span style={{ color: "#10b981", background: "rgba(16,185,129,0.12)", padding: "4px 10px", borderRadius: "12px", fontWeight: 800, fontSize: "0.82rem" }}>
                            ✓ مكتمل ومؤرشف
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Signature */}
        <div style={{ marginTop: "56px", borderTop: "2px solid #96701A", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.95rem", color: "#524F4B", fontWeight: 600 }}>
          <div>
            <div style={{ color: "#050505", fontWeight: 800 }}>إدارة التدريب: الكابتن إبراهيم</div>
            <div style={{ fontSize: "0.85rem" }}>تُعد هذه الوثيقة تقريراً شاملاً لحالة المتدرب ومستواه التراكمي.</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <img src="/images/logo/hLogo.png" alt="Ibrahim Gym" style={{ height: "56px", width: "auto", objectFit: "contain" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
