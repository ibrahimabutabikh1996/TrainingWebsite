"use client";
import React, { useState } from "react";
import { isCustomExercise, type Day, type DayExercise } from "@/types/admin";

/* `reps` is stored as an array, a bare string, or a number depending on which
   version of the builder wrote the row — so it is read through this rather than
   assumed to have a `.length`. A string has one too, and it counts characters. */
function asReps(reps: DayExercise["reps"]): string[] {
  if (Array.isArray(reps)) return reps;
  if (reps === undefined || reps === null) return [];
  return [String(reps)];
}

interface ExportWorkoutClientProps {
  title: string;
  traineeName: string;
  startDate: string;
  weight: string;
  height: string;
  goal: string;
  days: Day[];
  videoMap: Record<string, string>;
  muscleMap?: Record<string, string>;
  courseId?: string | null;
  cycleId?: string | null;
  profileId?: string | null;
}

export default function ExportWorkoutClient({
  traineeName,
  startDate,
  weight,
  height,
  goal,
  days,
  videoMap,
  muscleMap = {},
  courseId,
  cycleId,
  profileId,
}: ExportWorkoutClientProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const getDayMuscles = (d: Day) => {
    // If the coach explicitly selected muscles in the builder, they take absolute precedence.
    if (Array.isArray(d.muscles) && d.muscles.length > 0) {
      const filtered = d.muscles.filter((m) => typeof m === "string" && m.trim() !== "" && m !== "الكل");
      if (filtered.length > 0) return filtered.join("، ");
    }

    const exMuscles = new Set<string>();
    const exercises = Array.isArray(d.exercises) ? d.exercises : [];
    
    // Auto-calculate from the actual exercises assigned to this day ONLY if no muscles were selected
    exercises.forEach((ex: DayExercise) => {
      // Prioritize live DB muscle mapping over the JSON snapshot if available
      const mStr = muscleMap[ex.refId || ""] || muscleMap[ex.id || ""] || muscleMap[ex.name_ar || ""] || ex.target_muscle || "";
      if (mStr) {
        mStr.split(/[,،]/).forEach((m: string) => {
          const cleaned = m.trim();
          if (cleaned && cleaned !== "عام" && cleaned !== "الكل") {
            exMuscles.add(cleaned);
          }
        });
      }
    });

    const arr = Array.from(exMuscles);
    return arr.length > 0 ? arr.join("، ") : "تمارين شاملة";
  };

  const downloadPDF = async () => {
    setIsDownloading(true);
    try {
      // Rendered server-side by Chrome's own print engine (Puppeteer), not
      // html2canvas — the PDF gets real, selectable text instead of a
      // rasterized screenshot.
      const params = new URLSearchParams();
      if (courseId) params.set("courseId", courseId);
      if (cycleId) params.set("cycleId", cycleId);
      if (profileId) params.set("profileId", profileId);

      const res = await fetch(`/api/export-workout/pdf?${params.toString()}`);
      if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
      const blob = await res.blob();

      const cleanName = (traineeName || "المشترك").trim().replace(/[\\/*?:"<>|]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `النظام-التدريبي-${cleanName}.pdf`;
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

  const formatRest = (ex: DayExercise) => {
    if (ex.rest_from && ex.rest_to) {
      const mapUnit = (u?: string) => (u === "دقيقة" || u === "min" || u === "mins" || u === "دقائق" ? "min" : "sec");
      const fU = mapUnit(ex.rest_from_unit);
      const tU = mapUnit(ex.rest_to_unit);
      if (fU === tU && ex.rest_from === ex.rest_to) return `${ex.rest_from} ${fU}`;
      if (fU === tU) return `${ex.rest_from} - ${ex.rest_to} ${fU}`;
      return `${ex.rest_from} ${fU} - ${ex.rest_to} ${tU}`;
    }
    const rt = String(ex.rest_time || "60 - 90 sec");
    return rt
      .replace(/من/g, "")
      .replace(/إلى/g, "-")
      .replace(/ثانية|ثواني|ثوان/g, "sec")
      .replace(/دقيقة|دقائق/g, "min")
      .trim();
  };

  const maxSetsInAll = Math.max(
    1,
    ...days.flatMap((d) => (Array.isArray(d.exercises) ? d.exercises.map((e) => e.sets ?? asReps(e.reps).length ?? 3) : [3]))
  );

  {/* The logo, divider rules, watermark and contact icons are all baked into
      workout_template.jpg, which is laid over the full A4 page. Only live text is
      overlaid, positioned against measurements taken from that image:
        logo         x  6.0-54.8mm   y   4.0-26.8mm
        header rule                  y  29.7-30.1mm
        footer rule                  y 282.0-282.4mm
        phone icon   x  5.4-14.3mm   y 284.6-293.5mm
        insta icon   x 195.7-204.6mm y 284.6-293.5mm */}
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
        /* Self-hosted rather than Google Fonts CDN so the PDF-rendering browser
           (Puppeteer) never depends on an external network fetch succeeding in time. */
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

        /* globals.css has ":lang(ar) *:not(.app-icon) { font-family: ... !important }",
           which outranks a plain "*" selector on specificity alone even with !important
           on both sides — hence the id selector here to win the cascade. */
        #pdf-export-root, #pdf-export-root * {
          font-family: 'Cairo', sans-serif !important;
        }

        .pdf-export-wrapper {
          font-family: 'Cairo', sans-serif !important;
        }

        /* Exactly one A4 sheet, with the template artwork stretched edge to edge.
           The image's aspect ratio is already 2480x3508 (A4), so 100% 100% scales
           it without distorting the baked-in logo, rules, watermark and icons. */
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
          /* Clears the header artwork (ends 30.1mm) and footer rule (starts 282mm). */
          padding: 34mm 8mm 19mm 8mm;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 30px rgba(0,0,0,0.08);
        }

        /* Sits in the gap between the logo (ends 54.8mm) and the right edge. */
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

        /* Vertically centred on the footer icons (284.6-293.5mm), set just inside
           each one so the text reads as a label attached to its icon. */
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

        /* Rule-only table: horizontal separators, no vertical borders and no cell
           fills, so the page's own background and watermark read through it.
           table-layout:fixed keeps every set column exactly the same width and the
           row height is fixed, so the grid stays evenly proportioned. */
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

        /* Headings stay on one line so the head row matches the data rows' height;
           only cell content is allowed to break mid-word when it has to. */
        .table-grid th {
          color: #0F4E79;
          font-weight: 800;
          font-size: 4.1mm;
          white-space: nowrap;
        }

        .table-grid td {
          color: #1a1a1a;
          font-weight: 600;
          font-size: 3.3mm;
          overflow-wrap: anywhere;
        }

        /* On a phone, fit the whole A4 sheet to the screen instead of letting it
           overflow.

           The sheet is a fixed 210mm — about 794px — with everything inside it
           positioned in millimetres against that width, so it cannot be reflowed
           to a narrow screen without coming apart. On a 375px phone it simply ran
           off the right edge and the reader saw a slice of it. Scaling the whole
           thing down keeps every proportion and shows the full page, small but
           complete, which is what was asked for.

           The zoom property, rather than a transform scale, on purpose: it scales
           the layout box too, so there is no leftover empty band beside or below
           the shrunken sheet and no horizontal scrollbar. Where zoom is not
           supported the sheet just keeps its size — the same view as today, so
           nothing regresses.

           Screen only. The PDF is produced with page.pdf(), which renders with
           print media, so none of this reaches it — it stays true A4. The widths
           step down with the sheet's own fit points, not the site's layout
           breakpoints, because what has to fit here is a fixed 794px object, not
           a fluid column. (No back-tick marks in this comment: it lives inside a
           template-literal style block, where a back-tick would end the string.) */
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
          /* No page margin: the template image is full-bleed and already carries
             its own 5mm margins, so Chrome must not add a second set on top. */
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      ` }} />

      {/* Action Bar (Not included in PDF download) */}
      <div className="no-print" style={{ maxWidth: "960px", margin: "0 auto 24px auto", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "16px 24px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", fontFamily: "'Cairo', sans-serif" }}>
            النظام التدريبي - {traineeName}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            style={{
              padding: "10px 20px",
              background: isDownloading ? "#64748b" : downloaded ? "#10b981" : "#0F4E79",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: isDownloading ? "wait" : "pointer",
              fontSize: "1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
              fontFamily: "'Cairo', sans-serif"
            }}
          >
            {isDownloading ? "جاري التجهيز..." : downloaded ? "تم التحميل" : "تحميل النظام التدريبي PDF"}
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

      {/* Document PDF Content Area - Multi-Page structure */}
      <div id="pdf-content-area" style={{ maxWidth: "960px", margin: "0 auto" }}>
        {days.length === 0 ? (
          <div className="pdf-page-card">
            {renderHeader()}
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b", fontSize: "1.3rem", fontWeight: 700, flex: "1 0 auto" }}>
              لا توجد بيانات تمارين لعرضها في هذا الجدول.
            </div>
            {renderFooter()}
          </div>
        ) : (
          days.map((d, dayIdx) => {
            const dayTitle = d.title || `اليوم التدريبي ${dayIdx + 1}`;
            const muscles = getDayMuscles(d);
            const exercises = Array.isArray(d.exercises) ? d.exercises : [];
            const dayMaxSets = Math.max(1, ...exercises.map((e) => e.sets ?? asReps(e.reps).length ?? 3), maxSetsInAll);

            const count = exercises.length;
            let rowHeight = "17.5mm";
            let cellPad = "4.2mm 1.5mm";
            let fontSize = "4.4mm";
            let titleFontSize = "4.7mm";
            let linkFontSize = "4.0mm";
            let headerMarginBottom = "16px";
            let stripPadding = "12px 20px";
            let stripFontSize = "1.25rem";
            let tableMarginTop = "4mm";

            if (count > 22) {
              rowHeight = "6.5mm"; cellPad = "0.6mm 1mm"; fontSize = "2.7mm"; titleFontSize = "2.9mm"; linkFontSize = "2.6mm"; headerMarginBottom = "6px"; stripPadding = "8px 16px"; stripFontSize = "1.05rem"; tableMarginTop = "2mm";
            } else if (count > 18) {
              rowHeight = "7.8mm"; cellPad = "1mm 1.2mm"; fontSize = "3.0mm"; titleFontSize = "3.2mm"; linkFontSize = "2.8mm"; headerMarginBottom = "8px"; stripPadding = "8px 16px"; stripFontSize = "1.1rem"; tableMarginTop = "2.5mm";
            } else if (count > 14) {
              rowHeight = "9.5mm"; cellPad = "1.4mm 1.2mm"; fontSize = "3.4mm"; titleFontSize = "3.6mm"; linkFontSize = "3.1mm"; headerMarginBottom = "10px"; stripPadding = "10px 18px"; tableMarginTop = "3mm";
            } else if (count > 11) {
              rowHeight = "11.5mm"; cellPad = "2mm 1.5mm"; fontSize = "3.7mm"; titleFontSize = "3.9mm"; linkFontSize = "3.4mm"; headerMarginBottom = "12px";
            } else if (count > 9) {
              rowHeight = "13.5mm"; cellPad = "2.6mm 1.5mm"; fontSize = "3.9mm"; titleFontSize = "4.2mm"; linkFontSize = "3.6mm"; headerMarginBottom = "14px";
            } else if (count > 7) {
              rowHeight = "15mm"; cellPad = "3.2mm 1.5mm"; fontSize = "4.1mm"; titleFontSize = "4.4mm"; linkFontSize = "3.7mm";
            } else if (count > 5) {
              rowHeight = "16.5mm"; cellPad = "3.8mm 1.5mm"; fontSize = "4.3mm"; titleFontSize = "4.6mm"; linkFontSize = "3.9mm";
            }

            return (
              <React.Fragment key={dayIdx}>
                {/* Each Day has its own dedicated PDF page block */}
                <div className="pdf-page-card">
                  
                  {/* Repeated Header on Every Page */}
                  {renderHeader()}

                  {/* Day Exercises & Content */}
                  <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", paddingBottom: "0" }}>
                    
                    {/* Day Header Strip */}
                    <div className="day-header-strip" style={{ background: "#f1f5f9", padding: stripPadding, borderRadius: "6px", borderLeft: "6px solid #0F4E79", borderRight: "6px solid #0F4E79", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: headerMarginBottom, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                      <div style={{ fontSize: stripFontSize, fontWeight: 800, color: "#0f172a" }}>
                        {dayTitle}
                      </div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0F4E79", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span></span>
                        <span>{muscles}</span>
                      </div>
                    </div>

                    {/* Workout Table */}
                    <table className="table-grid" style={{ marginTop: tableMarginTop, flex: "1 1 auto", height: "100%" }}>
                      <thead>
                        <tr style={{ height: "11mm" }}>
                          <th style={{ width: "9mm", padding: "2mm 1mm" }}>ت</th>
                          <th style={{ textAlign: "right", padding: "2mm 1.5mm" }}>اسم التمرين</th>
                          {Array.from({ length: dayMaxSets }).map((_, sIdx) => (
                            <th key={sIdx} style={{ width: "15mm", padding: "2mm 1mm" }}>
                              سيت {sIdx + 1}
                            </th>
                          ))}
                          <th style={{ width: "24mm", padding: "2mm 1mm" }}>وقت الراحة</th>
                          <th style={{ width: "26mm", padding: "2mm 1mm" }}>رابط الفيديو</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exercises.length === 0 ? (
                          <tr>
                            <td colSpan={5 + dayMaxSets} style={{ padding: "28px", color: "#64748b", fontWeight: 600 }}>
                              لا توجد تمارين مسجلة في هذا اليوم
                            </td>
                          </tr>
                        ) : (
                          exercises.map((ex, exIdx) => {
                            /* Custom rows are a title plus four free-text
                               columns. They have no sets, reps or rest, so the
                               standard cells below printed a rep of "10", a
                               row of dashes and a "60 - 90 sec" the coach never
                               entered. Print what was written instead, across
                               the columns those numbers would have filled. */
                            if (isCustomExercise(ex)) {
                              const cols = [ex.custom_col_1, ex.custom_col_2, ex.custom_col_3, ex.custom_col_4]
                                .map((c: unknown) => String(c ?? "").trim())
                                .filter(Boolean);
                              return (
                                <tr key={exIdx} style={{ height: rowHeight }}>
                                  <td style={{ fontWeight: 800, color: "#475569", height: rowHeight, padding: cellPad, fontSize: fontSize }}>{exIdx + 1}</td>
                                  <td style={{ textAlign: "right", fontWeight: 800, color: "#000", fontSize: titleFontSize, height: rowHeight, padding: cellPad }}>
                                    {ex.name_ar || "تمرين غير مسمى"}
                                  </td>
                                  <td
                                    colSpan={dayMaxSets + 2}
                                    style={{ textAlign: "right", color: "#0f172a", fontWeight: 700, height: rowHeight, padding: cellPad, fontSize: fontSize }}
                                  >
                                    {cols.length > 0 ? (
                                      <div style={{ display: "flex", gap: "3mm", flexWrap: "wrap", justifyContent: "flex-start" }}>
                                        {cols.map((c: string, cIdx: number) => (
                                          <span key={cIdx} style={{ flex: "1 1 0", minWidth: 0, overflowWrap: "anywhere" }}>{c}</span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ color: "#94a3b8" }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            }

                            const repsArr = Array.isArray(ex.reps)
                              ? ex.reps
                              : typeof (ex.reps as unknown) === "string"
                                ? String(ex.reps).split(/[-–,،]/).map((x) => x.trim()).filter(Boolean)
                                : ["10"];
                            const setCount = ex.sets ?? repsArr.length ?? 3;
                            const videoUrl = ex.video_url || videoMap[ex.refId || ""] || videoMap[ex.name_ar || ""] || "";

                            return (
                              <tr key={exIdx} style={{ height: rowHeight }}>
                                <td style={{ fontWeight: 800, color: "#475569", height: rowHeight, padding: cellPad, fontSize: fontSize }}>{exIdx + 1}</td>
                                <td style={{ textAlign: "right", fontWeight: 800, color: "#000", fontSize: titleFontSize, height: rowHeight, padding: cellPad }}>
                                  {ex.name_ar || "تمرين غير مسمى"}
                                </td>
                                {Array.from({ length: dayMaxSets }).map((_, sIdx) => {
                                  let val = "—";
                                  if (sIdx < setCount) {
                                    val = String(repsArr[sIdx] ?? repsArr[repsArr.length - 1] ?? "10");
                                  }
                                  return (
                                    <td key={sIdx} style={{ fontWeight: 800, color: sIdx < setCount ? "#0f172a" : "#94a3b8", height: rowHeight, padding: cellPad, fontSize: fontSize }}>
                                      {val}
                                    </td>
                                  );
                                })}
                                <td style={{ color: "#0F4E79", fontWeight: 800, direction: "ltr", height: rowHeight, padding: cellPad, fontSize: fontSize }}>
                                  {formatRest(ex)}
                                </td>
                                <td style={{ height: rowHeight, padding: cellPad }}>
                                  {videoUrl && /^https?:\/\//i.test(videoUrl.trim()) ? (
                                    <a
                                      href={videoUrl.trim()}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 800, fontSize: linkFontSize }}
                                    >
                                      رابط الفيديو
                                    </a>
                                  ) : (
                                    <span style={{ color: "#94a3b8", fontSize: linkFontSize }}>غير متوفر</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Repeated Footer on Every Page */}
                  {renderFooter()}
                </div>

                {/* Explicit Page Break between Days */}
                {dayIdx < days.length - 1 && (
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
