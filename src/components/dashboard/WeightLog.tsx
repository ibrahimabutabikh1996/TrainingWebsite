"use client";

import React, { useState, useTransition } from "react";
import { saveWeightLog } from "@/app/dashboard/actions";
import { CustomDatePicker } from "@/components/dashboard/CustomDatePicker";
import { Icon } from "@/components/Icon";
import toast from "react-hot-toast";
import { formatTimestamp, formatTimestampShort } from "@/lib/trainingDates";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/** One point on the progress chart: the logged weights, plus the intake weight
    the trainee started at, which is drawn first and flagged so it can be told
    apart from a weight they recorded themselves. */
interface ChartPoint {
  date: string;
  displayDate: string;
  weight: number;
  isOriginal: boolean;
}

interface WeightLogProps {
  profile: {
    id: string;
    weightLogs?: { date: string; weight: number }[];
    weight?: number | string;
    created_at?: string;
  };
  readonly?: boolean;
  /**
   * Rendered inside a container that already names it — the collapsible tab in
   * a month of the coach's timeline, whose summary carries the icon and the
   * title. Drops this component's own heading, which would otherwise appear
   * twice, and the centred max-width that would leave it narrower than the tabs
   * beside it.
   *
   * Opt-in, and false by default, because the trainee's dashboard renders this
   * as a page section of its own where both the heading and the width are
   * wanted. A default that changed behaviour here would change that page too.
   */
  embedded?: boolean;
  onSaveSuccess?: () => void;
}

export default function WeightLog({ profile, readonly, embedded, onSaveSuccess }: WeightLogProps) {
  const [isPending, startTransition] = useTransition();
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [weight, setWeight] = useState<string>("");

  const weightLogs = profile.weightLogs || [];
  const sortedLogs = [...weightLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const originalWeight = parseFloat(String(profile.weight || 0));
  const createdDateStr = profile.created_at ? new Date(profile.created_at).toISOString().split('T')[0] : "";
  
  const chartData: ChartPoint[] = [];
  if (originalWeight > 0) {
    chartData.push({
      date: createdDateStr || "بداية الاشتراك",
      displayDate: "الوزن الأصلي",
      weight: originalWeight,
      isOriginal: true
    });
  }
  
  sortedLogs.forEach(log => {
    chartData.push({
      date: log.date,
      displayDate: formatTimestampShort(log.date),
      weight: log.weight,
      isOriginal: false
    });
  });

  const minWeight = chartData.length > 0 ? Math.min(...chartData.map(d => d.weight)) : 0;
  const maxWeight = chartData.length > 0 ? Math.max(...chartData.map(d => d.weight)) : 0;

  const handleSave = () => {
    if (!selectedDate) {
      toast.error("يرجى اختيار التاريخ");
      return;
    }
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      toast.error("يرجى إدخال وزن صحيح");
      return;
    }
    if (selectedDate > todayStr) {
      toast.error("لا يمكن اختيار تاريخ في المستقبل");
      return;
    }

    startTransition(async () => {
      const res = await saveWeightLog(profile.id, selectedDate, parsedWeight);
      if (res.success) {
        toast.success("تم حفظ الوزن بنجاح");
        setWeight("");
        if (onSaveSuccess) onSaveSuccess();
      } else {
        toast.error(res.error || "حدث خطأ");
      }
    });
  };

  return (
    <div
      className="home-overview-container"
      style={embedded ? { maxWidth: "100%", margin: 0 } : { maxWidth: 1000 }}
    >
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--space-8)" }}>
          <Icon name="monitor_weight" style={{ fontSize: "36px", color: "var(--primary-on-tint)" }} />
          <h2 style={{ margin: 0, fontSize: "1.8rem", color: "var(--text)" }}>سجل الوزن الأسبوعي</h2>
        </div>
      )}

      {!readonly && (
        <div className="home-stat-card" style={{ padding: "var(--space-6)", marginBottom: "var(--space-10)", overflow: "visible" }}>
          <h3 style={{ margin: "0 0 var(--space-6) 0", fontSize: "1.2rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-on-tint)" }}><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/></svg>
            إضافة وزن جديد
          </h3>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-6)", 
            alignItems: "flex-end"
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "8px", display: "block", fontWeight: 600 }}>تاريخ القياس</label>
              <CustomDatePicker
                value={selectedDate}
                maxDate={todayStr}
                fullWidth={true}
                onChange={(val) => val && setSelectedDate(val)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "8px", display: "block", fontWeight: 600 }}>الوزن بالكيلوجرام (Kg)</label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="مثال: 75.5"
                  className="form-input"
                  style={{ height: "42px", paddingInlineEnd: "40px", fontSize: "1rem" }}
                />
                <span style={{ position: "absolute", insetInlineEnd: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "0.9rem", pointerEvents: "none" }}>
                  Kg
                </span>
              </div>
            </div>
            <div>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="dash-primary-btn"
                style={{ width: "100%", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap" }}
              >
                {isPending ? "جاري الحفظ..." : (
                  <>
                    <Icon name="save" style={{ fontSize: "20px" }} />
                    حفظ الوزن
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px", paddingInlineStart: "var(--space-2)" }}>
          <Icon name="history" style={{ color: "var(--primary-on-tint)" }} />
          السجل التاريخي للأوزان
        </h3>
        
        {weightLogs.length === 0 ? (
          <div className="home-stat-card" style={{ 
            textAlign: "center", 
            padding: "var(--space-10) var(--space-6)", 
            background: "transparent", 
            border: "1px dashed var(--border-strong)",
            boxShadow: "none"
          }}>
            <Icon name="monitor_weight" style={{ fontSize: "56px", color: "var(--text-muted)", marginBottom: "var(--space-4)", opacity: 0.5 }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "1.15rem", margin: "0 0 8px 0", fontWeight: 600 }}>لم تقم بتسجيل أي أوزان حتى الآن.</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>ابدأ بتسجيل وزنك الأول في النموذج أعلاه لتتبع تقدمك.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)", alignItems: "stretch" }}>
            
            {/* Chart Area */}
            <div className="home-stat-card" style={{ flex: "2 1 0", padding: "var(--space-6)", display: "flex", flexDirection: "column" }}>
              <h4 style={{ margin: "0 0 var(--space-6) 0", color: "var(--text)", fontSize: "1.1rem" }}>مسار الوزن</h4>
              <div style={{ flex: 1, minHeight: "300px" }}>
                {/* An explicit height rather than `100%`.
                    The dashboard keeps all four tab panels mounted and toggles
                    them with `display`, so this chart first measures itself
                    inside a hidden one — the browser reports
                    "width(0) and height(0) of chart should be greater than 0"
                    on every load. `100%` of a collapsed parent is 0; a number
                    is a number whether the panel is showing or not, and the
                    width still follows the container once it is. */}
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                    <YAxis domain={[Math.max(0, minWeight - 5), maxWeight + 5]} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={35} tickMargin={8} />
                    <Tooltip 
                      contentStyle={{ background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--text)", direction: "rtl", textAlign: "right", boxShadow: "var(--elev-2)" }}
                      itemStyle={{ color: "var(--primary-on-tint)", fontWeight: 600 }}
                      formatter={(value) => [`${value ?? "—"} كجم`, "الوزن"]}
                      labelStyle={{ color: "var(--text-secondary)", marginBottom: "6px", fontSize: "0.9rem" }}
                    />
                    <Line type="monotone" dataKey="weight" stroke="var(--primary-on-tint)" strokeWidth={3} dot={{ r: 5, fill: "var(--bg)", stroke: "var(--primary-on-tint)", strokeWidth: 2 }} activeDot={{ r: 7, fill: "var(--primary-active)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table Area */}
            <div className="home-stat-card" style={{ flex: "1 1 0", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "400px" }}>
              <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--border)", background: "var(--bg2)", zIndex: 2 }}>
                <h4 style={{ margin: 0, color: "var(--text)", fontSize: "1.1rem" }}>سجل القراءات</h4>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--bg2)", zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: "var(--space-3) var(--space-6)", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>التاريخ</th>
                      <th style={{ padding: "var(--space-3) var(--space-4)", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>الوزن</th>
                      <th style={{ padding: "var(--space-3) var(--space-6)", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>التغير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((log, index, arr) => {
                      const prevLog = arr[index - 1];
                      const diff = prevLog ? log.weight - prevLog.weight : 0;
                      return (
                        <tr key={log.date + (log.isOriginal ? '-orig' : '')} style={{ 
                          borderBottom: "1px solid var(--border)", 
                          background: log.isOriginal ? "color-mix(in srgb, var(--primary) 3%, transparent)" : "transparent",
                          transition: "background var(--dur) var(--ease)"
                        }}>
                          <td style={{ padding: "var(--space-4) var(--space-6)", fontSize: "0.95rem" }}>
                            {log.isOriginal ? (
                              <span style={{ color: "var(--primary-on-tint)", fontWeight: 600 }}>الوزن الأصلي</span>
                            ) : (
                              <span style={{ color: "var(--text)" }}>{formatTimestamp(log.date)}</span>
                            )}
                          </td>
                          <td style={{ padding: "var(--space-4) var(--space-4)", fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>
                            {log.weight}
                          </td>
                          <td style={{ padding: "var(--space-4) var(--space-6)" }}>
                            {diff !== 0 ? (
                              <span style={{ 
                                display: "inline-flex", alignItems: "center", gap: "4px",
                                fontSize: "0.85rem", fontWeight: 700, padding: "2px 8px",
                                borderRadius: "var(--radius-pill)",
                                background: diff > 0 ? "var(--error-bg)" : "var(--success-bg)",
                                color: diff > 0 ? "var(--error-text)" : "var(--success-text)"
                              }}>
                                <Icon name={diff > 0 ? "trending_up" : "trending_down"} style={{ fontSize: "14px" }} />
                                {Math.abs(diff).toFixed(1)}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.9rem", paddingInlineStart: "8px" }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
