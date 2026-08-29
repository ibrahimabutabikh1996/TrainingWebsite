"use client";
import React, { useState } from "react";
import type { DietPlan, Meal, MealItem } from "@/types/diet";

interface ExportDietClientProps {
  traineeName: string;
  startDate: string;
  weight: string;
  height: string;
  goal: string;
  dietPlans: DietPlan[];
  profileId?: string | null;
}

export default function ExportDietClient({
  traineeName,
  startDate,
  weight,
  height,
  goal,
  dietPlans,
  profileId,
}: ExportDietClientProps) {
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

  const renderHeader = () => (
    <div className="pdf-header-info">
      <div className="pdf-header-row">
        <span>الاسم: <strong>{traineeName}</strong></span>
        <span>تاريخ الاشتراك: <strong>{startDate}</strong></span>
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
          src: url('/fonts/Cairo-Variable.woff2') format('woff2-variations'),
               url('/fonts/Cairo-Variable.woff2') format('woff2');
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
          margin-top: 4mm;
          text-align: center;
          border-top: 0.45mm solid #0F4E79;
        }

        .table-grid th,
        .table-grid td {
          background: transparent;
          border: none;
          border-bottom: 0.3mm solid #0F4E79;
          height: 10mm;
          padding: 1mm 1.5mm;
          vertical-align: middle;
        }

        .table-grid th {
          color: #0F4E79;
          font-weight: 800;
          font-size: 4.1mm;
          white-space: nowrap;
        }

        .table-grid td {
          color: #1a1a1a;
          font-weight: 700;
          font-size: 4mm;
          line-height: 1.3;
        }
        
        .meal-title-row td {
          background: rgba(15, 78, 121, 0.05);
          text-align: right;
          padding-right: 4mm;
          color: #0F4E79;
          font-weight: 800;
          font-size: 4.5mm;
          border-bottom: 0.5mm solid #0F4E79;
        }

        /* Fit the fixed 210mm sheet to a phone screen — see the fuller note in
           ExportWorkoutClient. The zoom property scales the layout box, so the
           several diet sheets stack tightly with no gaps between them rather than
           each reserving a full A4 height. Screen only; the PDF renders with
           print media and keeps its true A4 size. (No back-ticks here: this
           comment sits inside a template-literal style block.) */
        @media screen and (max-width: 820px) {
          .pdf-export-wrapper { padding: 12px 5px !important; }
          .pdf-page-card { zoom: 0.84; }
        }
        @media screen and (max-width: 680px) { .pdf-page-card { zoom: 0.69; } }
        @media screen and (max-width: 560px) { .pdf-page-card { zoom: 0.59; } }
        @media screen and (max-width: 480px) { .pdf-page-card { zoom: 0.53; } }
        @media screen and (max-width: 430px) { .pdf-page-card { zoom: 0.51; } }
        @media screen and (max-width: 414px) { .pdf-page-card { zoom: 0.48; } }
        @media screen and (max-width: 390px) { .pdf-page-card { zoom: 0.46; } }
        @media screen and (max-width: 375px) { .pdf-page-card { zoom: 0.44; } }
        @media screen and (max-width: 360px) { .pdf-page-card { zoom: 0.42; } }
        @media screen and (max-width: 345px) { .pdf-page-card { zoom: 0.40; } }
        @media screen and (max-width: 330px) { .pdf-page-card { zoom: 0.37; } }

        @media print {
          @page {
            size: A4;
            margin: 0 !important;
          }
          body, html {
            background: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .pdf-export-wrapper {
            background: none !important;
            padding: 0 !important;
          }
          .pdf-page-card {
            box-shadow: none !important;
            page-break-after: always;
          }
          .pdf-page-card:last-child {
            page-break-after: auto;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="no-print" style={{ maxWidth: "960px", margin: "0 auto 24px auto", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "16px 24px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
            النظام الغذائي - {traineeName}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: downloaded ? "#10b981" : "#0F4E79", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "1rem", fontWeight: 700, cursor: isDownloading ? "wait" : "pointer", transition: "all 0.2s" }}
          >
            {isDownloading ? "جاري التجهيز..." : downloaded ? "تم التحميل" : "تحميل النظام الغذائي PDF"}
          </button>
          <button
            onClick={() => {
              try { window.close(); } catch {}
              window.history.back();
            }}
            style={{
              padding: "10px 18px",
              background: "transparent",
              color: "#0F4E79",
              border: "1px solid rgba(15, 78, 121, 0.4)",
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

      <div id="pdf-content-area" style={{ maxWidth: "960px", margin: "0 auto" }}>
        {dietPlans.length === 0 ? (
          <div className="pdf-page-card">
            {renderHeader()}
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b", fontSize: "1.3rem", fontWeight: 700, flex: "1 0 auto" }}>
              لا توجد بيانات نظام غذائي لعرضها في هذا الجدول.
            </div>
            {renderFooter()}
          </div>
        ) : (
          dietPlans.map((plan: DietPlan, planIdx: number) => {
            const planTitle = plan.name || `النظام الغذائي ${planIdx + 1}`;
            const meals = Array.isArray(plan.meals) ? plan.meals : [];
            const totalItems = meals.reduce((sum, m) => sum + (m.items?.length || 0), 0);
            const totalRows = meals.length + totalItems;

            let rowHeight = "9.5mm";
            let fontSize = "4.0mm";
            let titleFontSize = "4.5mm";
            let headerMarginBottom = "12px";
            let stripPadding = "12px 20px";
            let stripFontSize = "1.25rem";
            let tableMarginTop = "4mm";

            if (totalRows > 24) {
              rowHeight = "6.5mm"; fontSize = "3.2mm"; titleFontSize = "3.6mm"; headerMarginBottom = "6px"; stripPadding = "8px 16px"; stripFontSize = "1.05rem"; tableMarginTop = "2mm";
            } else if (totalRows > 20) {
              rowHeight = "7.8mm"; fontSize = "3.5mm"; titleFontSize = "3.9mm"; headerMarginBottom = "8px"; stripPadding = "8px 16px"; stripFontSize = "1.1rem"; tableMarginTop = "2.5mm";
            }

            return (
              <React.Fragment key={planIdx}>
                <div className="pdf-page-card">
                  {renderHeader()}
                  <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", paddingBottom: "0" }}>
                    
                    <div className="day-header-strip" style={{ background: "#f1f5f9", padding: stripPadding, borderRadius: "6px", borderLeft: "6px solid #0F4E79", borderRight: "6px solid #0F4E79", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: headerMarginBottom, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                      <div style={{ fontSize: stripFontSize, fontWeight: 800, color: "#0f172a" }}>
                        {planTitle}
                      </div>
                    </div>

                    <table className="table-grid" style={{ marginTop: tableMarginTop, flex: "1 1 auto", height: "100%" }}>
                      <thead>
                        <tr style={{ height: "11mm" }}>
                          <th style={{ width: "10%", padding: "2mm 1mm" }}>ت</th>
                          <th style={{ textAlign: "right", padding: "2mm 1.5mm", width: "45%" }}>اسم الصنف</th>
                          <th style={{ width: "25%", padding: "2mm 1mm" }}>الفئة</th>
                          <th style={{ width: "20%", padding: "2mm 1mm" }}>الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meals.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: "28px", color: "#64748b", fontWeight: 600 }}>
                              لا توجد وجبات مسجلة في هذا النظام
                            </td>
                          </tr>
                        ) : (
                          meals.map((meal: Meal) => (
                            <React.Fragment key={meal.id}>
                              <tr className="meal-title-row" style={{ height: rowHeight }}>
                                <td colSpan={4} style={{ fontSize: titleFontSize }}>
                                  {meal.name} {meal.time ? `(${meal.time})` : ""}
                                </td>
                              </tr>
                              {meal.startNote && (
                                <tr style={{ height: rowHeight, backgroundColor: "#fafafa" }}>
                                  <td colSpan={4} style={{ textAlign: "right", paddingRight: "4mm", color: "#555", fontSize: fontSize }}>
                                    {meal.startNote}
                                  </td>
                                </tr>
                              )}
                              {meal.items.map((item: MealItem, itemIdx: number) => {
                                const baseGrams = 100;
                                const displayWeight = item.weight != null ? Math.round(item.weight * 10) / 10 : Math.round(item.qty * baseGrams * 10) / 10;
                                const unit = item.unit || "غرام";
                                const amountText = unit === "غرام" || unit === "مل" || unit === "لتر" || unit === "كغم" 
                                  ? `${displayWeight} ${unit}`
                                  : `${item.qty} ${unit} ${item.serving_size ? `(${item.serving_size})` : ""}`;

                                return (
                                  <tr key={item.id} style={{ height: rowHeight }}>
                                    <td style={{ fontSize: fontSize }}>{itemIdx + 1}</td>
                                    <td style={{ textAlign: "right", fontSize: fontSize }}>{item.name}</td>
                                    <td style={{ fontSize: fontSize }}>{item.category}</td>
                                    <td style={{ fontWeight: 800, color: "#0F4E79", fontSize: fontSize, direction: "ltr" }}>{amountText}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {renderFooter()}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
