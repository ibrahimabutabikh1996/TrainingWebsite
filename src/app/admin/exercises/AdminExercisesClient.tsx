"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { Exercise } from "@/types/admin";
import MuscleTabs from "../components/MuscleTabs";
import ExerciseFormModal from "./ExerciseFormModal";
import AdminModal from "../components/AdminModal";
import { useExercises, CATEGORIES } from "./useExercises";
import { getEmbedUrl } from "@/lib/videoEmbed";
import { Icon } from "@/components/Icon";
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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
          <div className="ex-stats">
            <span className="ex-stat"><b>{exercises.length}</b> تمرين</span>
            {CATEGORIES.map((c) => (
              <span key={c} className="ex-stat"><b>{countsByType[c] ?? 0}</b> {c}</span>
            ))}
            <span className="ex-stat"><b>{uniqueMuscles.length - 1}</b> عضلة</span>
          </div>
        </div>

        <button onClick={openAddModal} className="ex-add-btn">
          <Icon name="add" style={{ fontSize: 20 }} />
          <span>إضافة تمرين جديد</span>
        </button>
      </header>

      <div className="ex-toolbar">
        <div className="ex-toolbar-row">
          <div className="ex-search">
            <Icon name="search" />
            <input
              type="text"
              placeholder="ابحث باسم التمرين أو العضلة المستهدفة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ex-search-clear" onClick={() => setSearch("")} aria-label="مسح البحث">
                <Icon name="close" style={{ fontSize: 16 }} />
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
            <Icon name={exercises.length === 0 ? "exercise" : "search_off"} />
            <p>
              {exercises.length === 0
                ? "لا توجد تمارين بعد — ابدأ بإضافة أول تمرين إلى المكتبة"
                : "لا توجد تمارين تطابق البحث أو التصفية الحالية"}
            </p>
            {exercises.length === 0 ? (
              <button onClick={openAddModal} className="ex-add-btn">
                <Icon name="add" style={{ fontSize: 20 }} />
                <span>إضافة تمرين جديد</span>
              </button>
            ) : (
              isFiltered && (
                <button
                  className="ex-add-btn"
                  onClick={() => { setSearch(""); setSelectedCategory("الكل"); setSelectedType("الكل"); }}
                >
                  <Icon name="filter_alt_off" style={{ fontSize: 20 }} />
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
                {/* The title has the row to itself. The two icon buttons used
                    to sit beside it and took about 78px off a name that wraps
                    to three lines on a narrow column. */}
                <div className="ex-card-head">
                  <div className="ex-card-title">
                    <h3>{ex.name_ar}</h3>
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
                    <Icon name="sticky_note_2" />
                    <span>{ex.notes}</span>
                  </div>
                )}

                {/* Everything this card can be asked to do, on one line under a
                    rule — the shape `.co-card-foot` already gives the course
                    library. The video keeps its wording; it is the only one of
                    the three a coach opens to look at something rather than to
                    change it, and it is the reason most of these cards exist. */}
                <div className="ex-card-foot">
                  {ex.video_url && (
                    <button className="ex-video" onClick={() => setVideoUrl(ex.video_url)}>
                      <Icon name="play_circle" />
                      مشاهدة الفيديو
                    </button>
                  )}
                  <div className="ex-card-actions">
                    <button
                      className="ex-icon-btn"
                      onClick={() => openEditModal(ex)}
                      title="تعديل"
                      aria-label={`تعديل ${ex.name_ar}`}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      className="ex-icon-btn danger"
                      onClick={() => deleteExercise(ex.id)}
                      title="حذف"
                      aria-label={`حذف ${ex.name_ar}`}
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                </div>
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

      <AdminModal
        isOpen={!!videoUrl}
        onClose={() => setVideoUrl(null)}
        title="معاينة الفيديو"
        icon="play_circle"
        maxWidth={800}
      >
        {/* `getEmbedUrl` now answers null for an address a browser should not be
            pointed at, which is what a row stored before the API validated this
            field may still hold. Nothing is framed in that case. */}
        {videoUrl && getEmbedUrl(videoUrl) ? (
          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000" }}>
            <iframe
              src={getEmbedUrl(videoUrl)!}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          </div>
        ) : videoUrl ? (
          <p style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--text-muted)" }}>
            رابط الفيديو غير صالح — عدّله من نموذج التمرين.
          </p>
        ) : null}
      </AdminModal>
    </div>
  );
}
