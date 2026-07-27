"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { Exercise } from "@/types/admin";
import MuscleTabs from "../components/MuscleTabs";
import ExerciseFormModal from "./ExerciseFormModal";
import { useExercises, CATEGORIES } from "./useExercises";
import "../crm.css";
import "./exercises.css";

export default function AdminExercisesClient({ initialExercises }: { initialExercises: Exercise[] }) {
  const {
    exercises,
    search, setSearch,
    selectedCategory, setSelectedCategory,
    selectedType, setSelectedType,
    uniqueMuscles,
    filteredExercises,
    countsByType,
    saveExercise,
    deleteExercise,
  } = useExercises(initialExercises);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  /* Bumped on every open so the modal remounts with fields seeded from the
     exercise being edited, instead of syncing props into state in an effect. */
  const [modalKey, setModalKey] = useState(0);

  const openAddModal = () => {
    setEditingEx(null);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingEx(ex);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const isFiltered =
    search.trim() !== "" || selectedCategory !== "الكل" || selectedType !== "الكل";

  return (
    <div className="ex-page">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--bg2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            direction: "rtl",
            fontFamily: "inherit",
            fontWeight: 600,
          },
        }}
      />

      <header className="ex-header">
        <div className="ex-header-text">
          <h1>مكتبة التمارين</h1>
          <p>إدارة قاعدة بيانات التمارين الشاملة التي يعتمد عليها صانع الكورسات.</p>
          <div className="ex-stats">
            <span className="ex-stat"><b>{exercises.length}</b> تمرين</span>
            {CATEGORIES.map((c) => (
              <span key={c} className="ex-stat"><b>{countsByType[c] ?? 0}</b> {c}</span>
            ))}
            <span className="ex-stat"><b>{uniqueMuscles.length - 1}</b> عضلة</span>
          </div>
        </div>

        <button onClick={openAddModal} className="ex-add-btn">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          <span>إضافة تمرين جديد</span>
        </button>
      </header>

      <div className="ex-toolbar">
        <div className="ex-toolbar-row">
          <div className="ex-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="ابحث بالاسم العربي أو الإنجليزي..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ex-search-clear" onClick={() => setSearch("")} aria-label="مسح البحث">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>

          {/* The category was stored on every exercise but there was no way to
              filter by it before. */}
          <div className="ex-segment" role="group" aria-label="نوع التمرين">
            {["الكل", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedType(c)}
                aria-pressed={selectedType === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="ex-muscles">
          <p className="ex-filter-label">تصفية حسب العضلة المستهدفة</p>
          <MuscleTabs
            uniqueMuscles={uniqueMuscles}
            selectedMuscle={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>
      </div>

      <p className="ex-count">
        عرض <b>{filteredExercises.length}</b> من {exercises.length} تمرين
      </p>

      <div className="ex-grid">
        {filteredExercises.length === 0 ? (
          /* An empty library and a fruitless search need different wording. */
          <div className="ex-empty">
            <span className="material-symbols-outlined">
              {exercises.length === 0 ? "exercise" : "search_off"}
            </span>
            <p>
              {exercises.length === 0
                ? "لا توجد تمارين بعد — ابدأ بإضافة أول تمرين إلى المكتبة"
                : "لا توجد تمارين تطابق البحث أو التصفية الحالية"}
            </p>
            {exercises.length === 0 ? (
              <button onClick={openAddModal} className="ex-add-btn">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                <span>إضافة تمرين جديد</span>
              </button>
            ) : (
              isFiltered && (
                <button
                  className="ex-add-btn"
                  onClick={() => { setSearch(""); setSelectedCategory("الكل"); setSelectedType("الكل"); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_alt_off</span>
                  <span>إزالة التصفية</span>
                </button>
              )
            )}
          </div>
        ) : (
          filteredExercises.map((ex) => {
            const muscles = ex.target_muscle
              ? ex.target_muscle.split(",").map((m) => m.trim()).filter(Boolean)
              : [];
            const category = ex.category || "مقاومة";

            return (
              <article key={ex.id} className="ex-card">
                <div className="ex-card-head">
                  <div className="ex-card-title">
                    <h3>{ex.name_ar}</h3>
                    {ex.name_en && <span>{ex.name_en}</span>}
                  </div>
                  <div className="ex-card-actions">
                    <button
                      className="ex-icon-btn"
                      onClick={() => openEditModal(ex)}
                      title="تعديل"
                      aria-label={`تعديل ${ex.name_ar}`}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      className="ex-icon-btn danger"
                      onClick={() => deleteExercise(ex.id)}
                      title="حذف"
                      aria-label={`حذف ${ex.name_ar}`}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>

                <div className="ex-chips">
                  <span className="ex-chip ex-chip--cat" data-cat={category}>{category}</span>
                  {muscles.map((m, i) => (
                    <span key={i} className="ex-chip">{m}</span>
                  ))}
                </div>

                {ex.notes && (
                  <div className="ex-notes">
                    <span className="material-symbols-outlined">sticky_note_2</span>
                    <span>{ex.notes}</span>
                  </div>
                )}

                {/* The video link was captured in the form but never rendered,
                    so the coach could save one and never reach it again. */}
                {ex.video_url && (
                  <a className="ex-video" href={ex.video_url} target="_blank" rel="noreferrer">
                    <span className="material-symbols-outlined">play_circle</span>
                    مشاهدة الفيديو
                  </a>
                )}
              </article>
            );
          })
        )}
      </div>

      <ExerciseFormModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingEx={editingEx}
        uniqueMuscles={uniqueMuscles}
        onSave={saveExercise}
      />
    </div>
  );
}
