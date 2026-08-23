"use client";

import { useState } from "react";
import AdminModal from "../components/AdminModal";
import type { NutritionSource } from "@/types/admin";
import { CustomSelect } from "@/components/CustomSelect";

interface NutritionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSource: NutritionSource | null;
  onSave: (data: Omit<NutritionSource, "id" | "created_at">, id?: string) => Promise<void>;
}

export default function NutritionFormModal({
  isOpen,
  onClose,
  editingSource,
  onSave,
}: NutritionFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* A name and a category. The form used to ask for nine things — serving size,
     four macros, a photograph and a note — and the coach filled them in for a
     figure nobody was shown: the macros were summed into `dietCalories` on the
     profile payload, and no screen in the product ever read that field. The
     photographs were cleared from all 109 rows in favour of the category
     pictures. What is left is what the diet builder actually uses.
     Initialised from the source being edited, and reset by the `key` the caller
     passes rather than by an effect — see the note this replaces. */
  const [name, setName] = useState(editingSource?.name ?? "");
  const [category, setCategory] = useState(editingSource?.category ?? "مصادر البروتين");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: name.trim(),
          category,
          /* Carried through untouched rather than sent as null. The form no
             longer asks for these, and `updateNutritionSource` writes every
             field it is given — so posting nulls would erase the serving sizes
             and macros already stored, one source at a time as the coach edits
             them. Nothing reads those values today, but losing them silently is
             not the same as choosing to drop them. */
          image_url: editingSource?.image_url ?? null,
          serving_size: editingSource?.serving_size ?? null,
          calories: editingSource?.calories ?? null,
          protein: editingSource?.protein ?? null,
          carbs: editingSource?.carbs ?? null,
          fats: editingSource?.fats ?? null,
          notes: editingSource?.notes ?? null,
        },
        editingSource?.id
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSource ? "تعديل المصدر الغذائي" : "إضافة مصدر غذائي"}
      icon="restaurant_menu"
      maxWidth={600}
    >
      <form onSubmit={handleSubmit} className="diet-form">
        <div className="diet-form-row">
          <div className="diet-field">
            <label>
              اسم المصدر <span className="req">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: صدور الدجاج"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="diet-field">
            <label>التصنيف</label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              options={[
                { value: "مصادر البروتين", label: "مصادر البروتين" },
                { value: "مصادر الكاربوهيدرات", label: "مصادر الكاربوهيدرات" },
                { value: "مصادر الدهون الصحية", label: "مصادر الدهون الصحية" },
              ]}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} className="diet-modal-btn diet-modal-btn--ghost">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="diet-modal-btn diet-modal-btn--primary"
          >
            {isSubmitting ? "جاري الحفظ..." : "حفظ المصدر"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
