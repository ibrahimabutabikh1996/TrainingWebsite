"use client";

import { useState, useEffect } from "react";
import { Exercise } from "@/types/admin";
import AdminModal from "../components/AdminModal";

type ExerciseFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingEx: Exercise | null;
  uniqueMuscles: string[];
  onSave: (formData: any, editingEx: Exercise | null) => Promise<boolean>;
};

export default function ExerciseFormModal({ isOpen, onClose, editingEx, uniqueMuscles, onSave }: ExerciseFormModalProps) {
  const [formData, setFormData] = useState({
    name_ar: "",
    name_en: "",
    target_muscles: [] as string[],
    category: "مقاومة",
    video_url: "",
    notes: ""
  });
  
  const [customMuscle, setCustomMuscle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens or editingEx changes
  useEffect(() => {
    if (isOpen) {
      if (editingEx) {
        setFormData({
          name_ar: editingEx.name_ar || "",
          name_en: editingEx.name_en || "",
          target_muscles: editingEx.target_muscle ? editingEx.target_muscle.split(",").map(s => s.trim()) : [],
          category: editingEx.category || "مقاومة",
          video_url: editingEx.video_url || "",
          notes: editingEx.notes || ""
        });
      } else {
        setFormData({ name_ar: "", name_en: "", target_muscles: [], category: "مقاومة", video_url: "", notes: "" });
      }
      setCustomMuscle("");
    }
  }, [isOpen, editingEx]);

  const toggleMuscle = (muscle: string) => {
    setFormData(prev => {
      if (prev.target_muscles.includes(muscle)) {
        return { ...prev, target_muscles: prev.target_muscles.filter(m => m !== muscle) };
      } else {
        return { ...prev, target_muscles: [...prev.target_muscles, muscle] };
      }
    });
  };

  const handleAddCustomMuscle = () => {
    if (customMuscle.trim() && !formData.target_muscles.includes(customMuscle.trim())) {
      setFormData(prev => ({ ...prev, target_muscles: [...prev.target_muscles, customMuscle.trim()] }));
      setCustomMuscle("");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave(formData, editingEx);
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEx ? "تعديل التمرين" : "إضافة تمرين جديد"}
      icon={editingEx ? "edit" : "add_circle"}
      maxWidth={600}
      footer={
        <>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--admin-card-border)", color: "var(--admin-on-surface)", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>إلغاء</button>
          <button onClick={handleSave} disabled={isSaving} style={{ padding: "8px 24px", background: "var(--admin-primary)", border: "none", color: "white", borderRadius: 8, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: 18 }}>sync</span> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
            {editingEx ? "تحديث" : "حفظ"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>اسم التمرين بالعربية *</label>
          <input type="text" value={formData.name_ar} onChange={(e) => setFormData({...formData, name_ar: e.target.value})} style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-on-surface)", outline: "none" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>اسم التمرين بالإنجليزية</label>
          <input type="text" value={formData.name_en} onChange={(e) => setFormData({...formData, name_en: e.target.value})} style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-on-surface)", outline: "none" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>العضلات المستهدفة (يمكن اختيار أكثر من عضلة) *</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {uniqueMuscles.filter(m => m !== "الكل").map(m => {
              const isSelected = formData.target_muscles.includes(m);
              return (
                <button 
                  key={m} 
                  onClick={() => toggleMuscle(m)}
                  style={{ 
                    padding: "6px 12px", fontSize: "0.875rem", borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
                    background: isSelected ? "var(--admin-primary)" : "var(--admin-card-border)",
                    color: isSelected ? "white" : "var(--admin-on-surface)",
                    border: isSelected ? "1px solid var(--admin-primary)" : "1px solid var(--admin-card-border)",
                    display: "flex", alignItems: "center", gap: 4
                  }}
                >
                  {m}
                  {isSelected && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>}
                </button>
              );
            })}
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <input 
              type="text" 
              value={customMuscle}
              onChange={(e) => setCustomMuscle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomMuscle(); }}
              placeholder="إضافة عضلة جديدة..." 
              style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px dashed var(--admin-primary)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-primary)", outline: "none" }} 
            />
            <button 
              onClick={handleAddCustomMuscle}
              disabled={!customMuscle.trim()}
              style={{ padding: "0 16px", background: "rgba(173,198,255,0.1)", color: "var(--admin-primary)", border: "1px solid rgba(173,198,255,0.3)", borderRadius: 8, cursor: customMuscle.trim() ? "pointer" : "not-allowed", opacity: customMuscle.trim() ? 1 : 0.5 }}
            >
              إضافة
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>النوع / التصنيف</label>
          <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-on-surface)", outline: "none" }}>
            <option value="مقاومة" style={{ background: "var(--admin-bg-color)" }}>مقاومة</option>
            <option value="كارديو" style={{ background: "var(--admin-bg-color)" }}>كارديو</option>
            <option value="إطالة" style={{ background: "var(--admin-bg-color)" }}>إطالة</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--admin-outline)", marginBottom: 8, fontWeight: 500 }}>ملاحظات أداء التمرين</label>
          <textarea rows={3} value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-on-surface)", outline: "none", resize: "vertical" }} />
        </div>
      </div>
    </AdminModal>
  );
}
