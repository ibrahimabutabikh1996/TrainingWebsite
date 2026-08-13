import React from "react";
import { prisma } from "@/lib/db";

export async function AdminWeightLogs({ profileId }: { profileId: string }) {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { data: true },
  });

  if (!profile) return null;

  const currentData = typeof profile.data === "string" ? JSON.parse(profile.data) : (profile.data || {});
  const weightLogs: { date: string; weight: number }[] = currentData.weightLogs || [];

  if (weightLogs.length === 0) return null;

  // sort descending (newest first)
  const sortedLogs = [...weightLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="cms-card">
      <div className="cms-card-header">
        <h3 className="cms-card-title">متابعة الوزن الأسبوعي</h3>
      </div>
      <div className="cms-card-body">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-4)"
        }}>
          {sortedLogs.map((log, index) => {
            const diff = index < sortedLogs.length - 1 ? log.weight - sortedLogs[index + 1].weight : 0;
            return (
              <div key={log.date} style={{
                padding: "var(--space-4)",
                background: "var(--bg3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)"
              }}>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  {new Date(log.date).toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--weight-bold)", color: "var(--text)" }}>
                  {log.weight} كجم
                </div>
                {index < sortedLogs.length - 1 && diff !== 0 && (
                  <div style={{ 
                    fontSize: "var(--text-sm)", 
                    color: diff > 0 ? "var(--error-text)" : "var(--success-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {diff > 0 ? "↗" : "↘"} {Math.abs(diff).toFixed(1)} كجم
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
