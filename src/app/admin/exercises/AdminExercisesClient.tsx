"use client";

import { useState } from "react";
import { Exercise } from "@/types/admin";
import MuscleTabs from "../components/MuscleTabs";
import ExerciseFormModal from "./ExerciseFormModal";
import { useExercises } from "./useExercises";
import "../crm.css";

export default function AdminExercisesClient({ initialExercises }: { initialExercises: Exercise[] }) {
  const {
    search, setSearch,
    selectedCategory, setSelectedCategory,
    uniqueMuscles,
    filteredExercises,
    saveExercise,
    deleteExercise
  } = useExercises(initialExercises);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);

  const openAddModal = () => {
    setEditingEx(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingEx(ex);
    setIsModalOpen(true);
  };

  return (
    <div>
      <header className="crm-header" style={{ marginBottom: 24, flexDirection: "row", alignItems: "center" }}>
        <div>
          <h2 className="crm-title">مكتبة التمارين</h2>
          <p className="crm-desc">إدارة قاعدة بيانات التمارين الشاملة لتكوين الكورسات.</p>
        </div>
        
        <button onClick={openAddModal} className="crm-badge primary" style={{ padding: "8px 16px", cursor: "pointer", fontSize: "0.875rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          <span>إضافة تمرين جديد</span>
        </button>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Filters */}
        <div className="crm-glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="crm-search-box" style={{ maxWidth: 400 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--admin-outline)", fontSize: 18 }}>search</span>
            <input 
              type="text" 
              placeholder="ابحث عن تمرين..." 
              className="crm-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <MuscleTabs 
            uniqueMuscles={uniqueMuscles} 
            selectedMuscle={selectedCategory} 
            onSelect={setSelectedCategory} 
          />
        </div>

        {/* Exercises Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filteredExercises.map(ex => (
            <div key={ex.id} className="crm-glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
              <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 4 }}>
                <button onClick={() => openEditModal(ex)} style={{ background: "transparent", border: "none", color: "var(--admin-outline)", cursor: "pointer", padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span></button>
                <button onClick={() => deleteExercise(ex.id)} style={{ background: "transparent", border: "none", color: "var(--admin-error)", cursor: "pointer", padding: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span></button>
              </div>
              
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-on-surface)", paddingRight: 48, marginBottom: 4 }}>{ex.name_ar}</h4>
                {ex.name_en && <div style={{ fontSize: "0.75rem", color: "var(--admin-outline)", paddingRight: 48 }}>{ex.name_en}</div>}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {ex.target_muscle?.split(",").map((m, i) => (
                  <span key={i} className="crm-badge secondary" style={{ fontSize: "0.7rem", padding: "4px 8px" }}>{m.trim()}</span>
                ))}
                <span className="crm-badge primary" style={{ fontSize: "0.7rem", padding: "4px 8px" }}>{ex.category || "مقاومة"}</span>
              </div>
              
              {ex.notes && (
                <div style={{ fontSize: "0.75rem", color: "var(--admin-outline)", marginTop: 8, background: "var(--bg2)", padding: 8, borderRadius: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>sticky_note_2</span>
                  {ex.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ExerciseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingEx={editingEx}
        uniqueMuscles={uniqueMuscles}
        onSave={saveExercise}
      />
    </div>
  );
}
