import { UserProfile } from "@/types";

export function UserAnswers({ profile }: { profile: UserProfile }) {
  const data = profile.raw_answers || {};

  // Define some interesting keys to show
  const fields = [
    { label: "الجنس", value: data.gender === "female" ? "أنثى" : "ذكر" },
    { label: "العمر", value: data.age },
    { label: "الوزن", value: `${data.weight} kg` },
    { label: "الطول", value: `${data.height} cm` },
    { label: "الهدف", value: data.goal },
    { label: "مستوى النشاط", value: data.activity },
    { label: "عدد الأيام", value: data.days },
    { label: "مكان التدريب", value: data.place },
    { label: "الأدوات المتاحة", value: data.equipment },
    { label: "التفضيلات الغذائية", value: data.diet_preference },
    { label: "الحساسية", value: data.allergies },
    { label: "الإصابات", value: data.injuries },
  ];

  const validFields = fields.filter(f => f.value && f.value !== "غير محدد" && f.value.toString().trim() !== "");

  if (validFields.length === 0) return null;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-title">
        إجاباتي ومعلوماتي
      </div>
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "16px",
        marginTop: "16px"
      }}>
        {validFields.map((field, idx) => (
          <div key={idx} style={{
            background: "var(--bg-3)",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
          }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              {field.label}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)" }}>
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
