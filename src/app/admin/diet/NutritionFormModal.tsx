"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import AdminModal from "../components/AdminModal";
import { uploadMediaWithProgress } from "@/lib/mediaUpload";
import type { NutritionSource } from "@/types/admin";
import { Icon } from "@/components/Icon";
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
  const [isUploading, setIsUploading] = useState(false);

  /* Nine fields, initialised from the source being edited — or empty for a new
     one. This used to be an effect on `editingSource` that assigned all nine on
     every change: a full extra render each time the modal opened, and a form
     that briefly showed the previous item's values. The caller now passes a
     `key` tied to the source's id, so React discards this component and builds
     a fresh one instead — the reset React documents for exactly this. */
  const [name, setName] = useState(editingSource?.name ?? "");
  const [category, setCategory] = useState(editingSource?.category ?? "مصادر البروتين");
  const [imageUrl, setImageUrl] = useState(editingSource?.image_url ?? "");
  const [servingSize, setServingSize] = useState(editingSource?.serving_size ?? "");
  const [calories, setCalories] = useState(editingSource?.calories?.toString() ?? "");
  const [protein, setProtein] = useState(editingSource?.protein?.toString() ?? "");
  const [carbs, setCarbs] = useState(editingSource?.carbs?.toString() ?? "");
  const [fats, setFats] = useState(editingSource?.fats?.toString() ?? "");
  const [notes, setNotes] = useState(editingSource?.notes ?? "");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      /* Resized before it is sent, and reported into the upload window while it
         goes. This used to post `e.target.files[0]` straight through — the
         camera's own file, several thousand pixels wide, for a picture drawn in
         a 56-pixel box — and said nothing at all until it was over. */
      const url = await uploadMediaWithProgress(file);
      if (url) {
        setImageUrl(url);
        toast.success("تم رفع الصورة بنجاح");
      }
      /* A refusal is already named in the window, on the file it belongs to. */
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: name.trim(),
          category,
          image_url: imageUrl.trim() || null,
          serving_size: servingSize.trim() || null,
          calories: calories ? parseFloat(calories) : null,
          protein: protein ? parseFloat(protein) : null,
          carbs: carbs ? parseFloat(carbs) : null,
          fats: fats ? parseFloat(fats) : null,
          notes: notes.trim() || null,
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

        <div className="diet-form-row">
          <div className="diet-field">
            <label>حجم الحصة (Serving Size)</label>
            <input
              type="text"
              placeholder="مثال: 100 جرام، كوب واحد"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
            />
          </div>
          <div className="diet-field">
            <label>السعرات الحرارية</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="مثال: 165"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </div>
        </div>

        <div className="diet-form-row">
          <div className="diet-field">
            <label>البروتين (ج)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="مثال: 31"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div className="diet-field">
            <label>الكاربوهيدرات (ج)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="مثال: 0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div className="diet-field">
            <label>الدهون (ج)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="مثال: 3.6"
              value={fats}
              onChange={(e) => setFats(e.target.value)}
            />
          </div>
        </div>

        <div className="diet-field">
          <label>صورة المصدر (اختياري)</label>
          <div className="diet-image-field">
            <div className="diet-image-preview">
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <Icon name="image" />
              )}
            </div>
            <div className="diet-image-controls">
              <input
                type="url"
                placeholder="رابط الصورة: https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                dir="ltr"
              />
              <label className="diet-upload-btn">
                <Icon name="upload" style={{ fontSize: 18 }} />
                <span>{isUploading ? "جاري الرفع..." : "رفع صورة من الجهاز"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  hidden
                />
              </label>
            </div>
          </div>
        </div>

        <div className="diet-field">
          <label>ملاحظات إضافية (اختياري)</label>
          <textarea
            placeholder="مثال: يفضل سلقه أو شويه بدون زيت..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
