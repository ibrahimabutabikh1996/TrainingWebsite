// @ts-nocheck
"use client";

import React, { useState } from "react";
import type { DietPlan } from "@/types/diet";
import { MEAL_SLOTS, fmtMacro } from "@/types/diet";
import { Icon } from "@/components/Icon";

interface Props {
  traineeName: string;
  planName: string;
  weight: string;
  height: string;
  goal: string;
  allergies: string;
  dietPlans: DietPlan[];
  profileId?: string;
}

export default function ExportDietClient({
  traineeName,
  planName,
  weight,
  height,
  goal,
  allergies,
  dietPlans,
  profileId,
}: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const downloadPDF = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams();
      if (profileId) params.set("profileId", profileId);

      const res = await fetch(`/api/export-diet/pdf?${params.toString()}`);
      if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
      const blob = await res.blob();

      const cleanName = (traineeName || "المشترك").trim().replace(/[\\/*?:"<>|]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `النظام-الغذائي-${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  {/* The logo, divider rules, watermark and contact icons are baked into
      workout_template.jpg, which is laid over the full A4 page. */}
  const renderHeader = () => (
    <div className="pdf-header-info">
      <div className="pdf-header-row">
        <span>الاسم: <strong>{traineeName}</strong></span>
        {allergies && allergies !== "لا توجد موانع أو حساسية" && (
          <span>الموانع: <strong style={{ color: "#b91c1c" }}>{allergies}</strong></span>
        )}
      </div>
      <div className="pdf-header-row">
        <span>الوزن: <strong>{weight}</strong></span>
        <span>الطول: <strong>{height}</strong></span>
        <span>الهدف: <strong>{goal}</strong></span>
      </div>
    </div>
  );

  const renderFooter = () => (
    <>
      <div className="pdf-footer-phone" dir="ltr">07877511605</div>
      <div className="pdf-footer-insta" dir="ltr">ibrahim abutabikh</div>
    </>
  );

  return (
    <div id="pdf-export-root" className="pdf-export-wrapper" style={{ direction: "rtl", fontFamily: "'Cairo', sans-serif", background: "#f1f4f8", minHeight: "100vh", padding: "24px 16px", color: "#000" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'Cairo';
          font-style: normal;
          font-weight: 200 1000;
          font-display: swap;
          src: url('/fonts/Cairo-VariableFont_slnt,wght.woff2') format('woff2');
        }

        * {
          box-sizing: border-box;
        }

        #pdf-export-root, #pdf-export-root * {
          font-family: 'Cairo', sans-serif !important;
        }

        .pdf-export-wrapper {
          font-family: 'Cairo', sans-serif !important;
        }

        .pdf-page-card {
          position: relative;
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          overflow: hidden;
          background-color: #F0F0F0;
          background-image: url('/templates/workout_template.jpg');
          background-repeat: no-repeat;
          background-position: center;
          background-size: 100% 100%;
          padding: 34mm 8mm 19mm 8mm;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 30px rgba(0,0,0,0.08);
        }

        .pdf-header-info {
          position: absolute;
          top: 4mm;
          left: 58mm;
          right: 8mm;
          height: 23mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 2mm;
          font-size: 3.5mm;
          line-height: 1.25;
          font-weight: 700;
          color: #111827;
        }

        .pdf-header-row {
          display: flex;
          flex-wrap: wrap;
          gap: 2mm 7mm;
        }

        .pdf-header-info strong {
          color: #0f172a;
        }

        .pdf-footer-phone,
        .pdf-footer-insta {
          position: absolute;
          top: 284.6mm;
          height: 8.9mm;
          display: flex;
          align-items: center;
          font-size: 3.5mm;
          font-weight: 800;
          color: #0f172a;
        }

        .pdf-footer-phone {
          left: 17mm;
        }

        .pdf-footer-insta {
          right: 17mm;
        }

        .table-grid {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 3mm;
          text-align: center;
          border-top: 0.45mm solid #0F4E79;
          
          --row-height: 9mm;
          --cell-padding: 1.5mm;
          --th-font: 3.8mm;
          --td-font: 3.4mm;
        }

        .table-grid th,
        .table-grid td {
          background: transparent;
          border: none;
          border-bottom: 0.3mm solid #0F4E79;
          height: var(--row-height);
          padding: var(--cell-padding);
          vertical-align: middle;
        }

        .table-grid th {
          color: #0F4E79;
          font-weight: 800;
          font-size: var(--th-font);
          white-space: nowrap;
        }

        .table-grid td {
          color: #1a1a1a;
          font-weight: 700;
          font-size: var(--td-font);
          overflow-wrap: anywhere;
        }

        @media print {
          body, .pdf-export-wrapper {
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
          .pdf-page-card {
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pdf-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .table-grid tr {
            page-break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      ` }} />

      {/* Action Bar (Not included in PDF) */}
      {/* The sheet below is a print artifact and keeps its own paper palette in
          both themes; this toolbar is app UI, so it matches the document rather
          than the black-and-gold of the retired brand. */}
      <div className="no-print" style={{ maxWidth: "960px", margin: "0 auto 24px auto", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFFFFF", color: "#0F172A", padding: "16px 22px", borderRadius: "12px", border: "1px solid #CBD5E1", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", fontFamily: "'Cairo', sans-serif", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>تصدير الجدول الغذائي وتحميل الـ PDF</span>
            {isDownloading && (
              <span style={{ fontSize: "0.82rem", padding: "3px 12px", background: "#FEF3C7", color: "#78350F", borderRadius: "20px", fontWeight: 800 }}>
                ⏳ جاري التجهيز والتحميل المباشر...
              </span>
            )}
            {downloaded && !isDownloading && (
              <span style={{ fontSize: "0.82rem", padding: "3px 12px", background: "#DCFCE7", color: "#14532D", borderRadius: "20px", fontWeight: 800 }}>
                ✅ تم تحميل الملف في مجلد التنزيلات
              </span>
            )}
          </h2>
          <p style={{ margin: "6px 0 0 0", fontSize: "0.9rem", color: "#475569" }}>
            تم مطابقة فورم تصميم الجدول الغذائي بالكامل مع قالب النظام التدريبي (الكورس) بدقة فائقة.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            style={{
              padding: "10px 24px",
              background: isDownloading ? "#64748b" : "#0F4E79",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 800,
              cursor: isDownloading ? "not-allowed" : "pointer",
              fontSize: "1.05rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: isDownloading ? "none" : "0 4px 12px rgba(15, 78, 121, 0.35)",
              fontFamily: "'Cairo', sans-serif"
            }}
          >
            <span>{isDownloading ? "⏳ جاري التحميل..." : downloaded ? "⬇️ إعادة تحميل الـ PDF" : "⬇️ تحميل ملف الـ PDF"}</span>
          </button>
          <button
            onClick={() => {
              try { window.close(); } catch {}
              window.history.back();
            }}
            style={{
              padding: "10px 18px",
              background: "transparent",
              color: "#475569",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.95rem",
              fontFamily: "'Cairo', sans-serif"
            }}
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Document PDF Content Area - Multi-Page structure */}
      <div id="pdf-content-area" style={{ maxWidth: "960px", margin: "0 auto" }}>
        {dietPlans.length === 0 ? (
          <div className="pdf-page-card">
            {renderHeader()}
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b", fontSize: "1.3rem", fontWeight: 700, flex: "1 0 auto" }}>
              لا توجد خطط غذائية مسجلة لعرضها في هذا الجدول.
            </div>
            {renderFooter()}
          </div>
        ) : (
          dietPlans.map((plan, planIdx) => {
            const totalRows = MEAL_SLOTS.reduce((acc, slot) => {
              const meal = plan.meals[slot.key];
              if (!meal || (meal.items.length === 0 && !meal.time)) return acc;
              return acc + 1 + Math.max(1, meal.items.length);
            }, 0);
            
            const maxRows = 17;
            const tableZoom = totalRows > maxRows ? Math.max(0.5, maxRows / totalRows) : 1;

            return (
              <React.Fragment key={planIdx}>
                <div className="pdf-page-card">
                  {renderHeader()}

                  <div style={{ flex: "1 0 auto", paddingBottom: "16px" }}>
                    {/* Plan Header Strip */}
                    <div className="day-header-strip" style={{ background: "#f1f5f9", padding: "10px 18px", borderRadius: "6px", borderLeft: "6px solid #0F4E79", borderRight: "6px solid #0F4E79", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "12px", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                        {plan.name === "النظام الأول" ? "النظام الغذائي الاختيار الأول" :
                         plan.name === "النظام الثاني" ? "النظام الغذائي الاختيار الثاني" :
                         plan.name === "النظام الثالث" ? "النظام الغذائي الاختيار الثالث" :
                         plan.name || `الخطة الغذائية رقم ${planIdx + 1}`}
                      </div>
                    </div>

                    {/* Rule-Only Table */}
                    <table className="table-grid" style={{ 
                      "--row-height": `${9 * tableZoom}mm`,
                      "--cell-padding": `${1.5 * tableZoom}mm`,
                      "--th-font": `${3.8 * tableZoom}mm`,
                      "--td-font": `${3.4 * tableZoom}mm`,
                      "--header-row": `${10 * tableZoom}mm`,
                      "--meal-row": `${8.5 * tableZoom}mm`,
                      "--meal-font": `${4.0 * tableZoom}mm`,
                      "--meal-time-font": `${3.4 * tableZoom}mm`
                    } as React.CSSProperties}>
                      <thead>
                        <tr style={{ height: "var(--header-row)" }}>
                          <th style={{ width: "12mm", padding: "var(--cell-padding) 1mm" }}>ت</th>
                          <th style={{ textAlign: "right", padding: "var(--cell-padding)", width: "102mm" }}>الصنف الغذائي</th>
                          <th style={{ width: "80mm", padding: "var(--cell-padding)" }}>الكمية / الوزن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MEAL_SLOTS.map((slot) => {
                          const meal = plan.meals[slot.key];
                          if (!meal || (meal.items.length === 0 && !meal.time)) return null;

                          return (
                            <React.Fragment key={slot.key}>
                              {/* Meal Slot Group Header Row */}
                              <tr style={{ backgroundColor: "rgba(15, 78, 121, 0.08)", borderTop: "0.45mm solid #0F4E79", borderBottom: "0.35mm solid #0F4E79", height: "var(--meal-row)" }}>
                                <td colSpan={3} style={{ textAlign: "right", padding: "var(--cell-padding) 3mm", fontWeight: 900, color: "#0F4E79", fontSize: "var(--meal-font)", background: "rgba(15, 78, 121, 0.08)" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginInlineEnd: "14px", fontWeight: 900 }}>
                                    <Icon name={slot.icon as any || "restaurant_menu"} style={{ width: "4.5mm", height: "4.5mm", strokeWidth: 2.5 }} />
                                    <span>{slot.label}</span>
                                  </div>
                                  {meal.time && (
                                    <span style={{ color: "#334155", fontSize: "var(--meal-time-font)", fontWeight: 800 }}>
                                      ⏰ الوقت الموصى به: {meal.time}
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {/* Food Items under this meal */}
                              {meal.items.length === 0 ? (
                                <tr>
                                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", fontWeight: 600, padding: "3mm" }}>
                                    حسب الرغبة أو إرشادات الكابتن
                                  </td>
                                </tr>
                              ) : (
                                meal.items.map((mItem, idx) => {
                                  const weightVal = mItem.weight != null ? Math.round(mItem.weight * 10) / 10 : Math.round((mItem.qty || 1) * 100 * 10) / 10;
                                  const qtyVal = mItem.qty != null ? mItem.qty : 1;
                                  const unit = mItem.unit || "غرام";
                                  const prefix = (unit === "غرام" || unit === "كغم") ? "الوزن" : "الكمية";
                                  const unitSuffix = unit === "بدون وحدة قياس" ? "" : ` ${unit}`;
                                  
                                  const parts: string[] = [];
                                  if (qtyVal > 0) parts.push(`العدد: ${fmtMacro(qtyVal)}`);
                                  if (weightVal > 0) parts.push(`${prefix}: ${weightVal}${unitSuffix}`);
                                  const portionText = parts.length > 0 ? parts.join(" | ") : "حسب الرغبة";

                                  return (
                                    <tr key={idx} style={{ height: "9mm" }}>
                                      <td style={{ fontWeight: 800, color: "#475569" }}>{idx + 1}</td>
                                      <td style={{ textAlign: "right", fontWeight: 800, color: "#000", fontSize: "3.7mm" }}>
                                        {mItem.name || "صنف غذائي"}
                                      </td>
                                      <td style={{ fontWeight: 800, color: "#0F4E79", fontSize: "3.5mm" }}>
                                        {portionText}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {renderFooter()}
                </div>

                {planIdx < dietPlans.length - 1 && (
                  <>
                    <div className="no-print" style={{ height: "32px" }} />
                    <div className="pdf-page-break" style={{ pageBreakAfter: "always", breakAfter: "page" }} />
                  </>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
