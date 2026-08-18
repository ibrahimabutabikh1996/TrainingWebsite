"use client";

import { useState } from "react";
import { Exercise } from "@/types/admin";
import AdminModal from "../components/AdminModal";
import { CATEGORIES, type ExerciseFormValues } from "./useExercises";
import { Icon } from "@/components/Icon";
import { CustomSelect } from "@/components/CustomSelect";
import "./exercises.css";

type ExerciseFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingEx: Exercise | null;
  uniqueMuscles: string[];
  onSave: (formData: ExerciseFormValues, editingEx: Exercise | null) => Promise<boolean>;
};

const EMPTY: ExerciseFormValues = {
  name_ar: "",
  target_muscles: [],
  category: "مقاومة",
  video_url: "",
  notes: "",
};

export default function ExerciseFormModal({
  isOpen,
  onClose,
  editingEx,
  uniqueMuscles,
  onSave,
}: ExerciseFormModalProps) {
  /* Seeded straight from the prop. The parent remounts this via `key` on every
     open, so there is no need to copy props into state inside an effect —
     which is the pattern React warns about and which also re-ran on unrelated
     re-renders. */
  const [formData, setFormData] = useState<ExerciseFormValues>(() =>
    editingEx
      ? {
          name_ar: editingEx.name_ar || "",
          target_muscles: editingEx.target_muscle
            ? editingEx.target_muscle.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          category: editingEx.category || "مقاومة",
          video_url: editingEx.video_url || "",
          notes: editingEx.notes || "",
        }
      : EMPTY
  );
  const [customMuscle, setCustomMuscle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleMuscle = (muscle: string) =>
    setFormData((prev) => ({
      ...prev,
      target_muscles: prev.target_muscles.includes(muscle)
        ? prev.target_muscles.filter((m) => m !== muscle)
        : [...prev.target_muscles, muscle],
    }));

  const addCustomMuscle = () => {
    const value = customMuscle.trim();
    if (!value) return;
    setFormData((prev) =>
      prev.target_muscles.includes(value)
        ? prev
        : { ...prev, target_muscles: [...prev.target_muscles, value] }
    );
    setCustomMuscle("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSave(formData, editingEx);
    setIsSaving(false);
    if (ok) onClose();
  };

  /* Options = every known muscle plus any newly typed one, so a custom entry
     shows up as a selected chip instead of vanishing into the joined string. */
  const knownMuscles = uniqueMuscles.filter((m) => m !== "الكل");
  const options = [
    ...knownMuscles,
    ...formData.target_muscles.filter((m) => !knownMuscles.includes(m)),
  ];

  const videoLooksWrong =
    formData.video_url.trim() !== "" && !/^https?:\/\//i.test(formData.video_url.trim());

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEx ? "تعديل التمرين" : "إضافة تمرين جديد"}
      icon={editingEx ? "edit" : "add_circle"}
      maxWidth={620}
      footer={
        <>
          <button onClick={onClose} className="ex-modal-btn ex-modal-btn--ghost">
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ex-modal-btn ex-modal-btn--primary"
          >
            {isSaving ? (
              <span className="ex-spinner" aria-hidden="true" />
            ) : (
              <Icon name="save" style={{ fontSize: 18 }} />
            )}
            {isSaving ? "جاري الحفظ..." : editingEx ? "تحديث" : "حفظ"}
          </button>
        </>
      }
    >
      <div className="ex-form">
        <div className="ex-form-row">
          <div className="ex-field">
            <label htmlFor="ex-name-ar">
              اسم التمرين <span className="req">*</span>
            </label>
            <input
              id="ex-name-ar"
              type="text"
              value={formData.name_ar}
              onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
              placeholder="مثال: بنش برس مستوي"
            />
          </div>
        </div>

        <div className="ex-field">
          <label>
            العضلات المستهدفة <span className="req">*</span>
          </label>
          <div className="ex-muscle-picker">
            {options.map((m) => {
              const selected = formData.target_muscles.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  className="ex-muscle-opt"
                  aria-pressed={selected}
                  onClick={() => toggleMuscle(m)}
                >
                  {selected && <Icon name="check" />}
                  {m}
                </button>
              );
            })}
          </div>

          <div className="ex-custom-row">
            <input
              type="text"
              value={customMuscle}
              onChange={(e) => setCustomMuscle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomMuscle();
                }
              }}
              placeholder="إضافة عضلة غير موجودة في القائمة..."
            />
            <button
              type="button"
              className="ex-custom-btn"
              onClick={addCustomMuscle}
              disabled={!customMuscle.trim()}
            >
              إضافة
            </button>
          </div>
          <span className="ex-field-hint">
            {formData.target_muscles.length > 0
              ? `تم اختيار ${formData.target_muscles.length}`
              : "اختر عضلة واحدة على الأقل"}
          </span>
        </div>

        <div className="ex-form-row">
          <div className="ex-field">
            <label htmlFor="ex-category">النوع / التصنيف</label>
            <CustomSelect
              id="ex-category"
              value={formData.category}
              onChange={(category) => setFormData({ ...formData, category })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="ex-field">
            <label htmlFor="ex-video">رابط فيديو التمرين</label>
            <input
              id="ex-video"
              type="url"
              dir="ltr"
              value={formData.video_url}
              onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
              placeholder="https://youtube.com/..."
            />
            {videoLooksWrong && (
              <span className="ex-field-hint error">
                يجب أن يبدأ الرابط بـ https://
              </span>
            )}
          </div>
        </div>

        <div className="ex-field">
          <label htmlFor="ex-notes">ملاحظات أداء التمرين</label>
          <textarea
            id="ex-notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="تعليمات الأداء الصحيح، تحذيرات، بدائل..."
          />
        </div>
      </div>
    </AdminModal>
  );
}
