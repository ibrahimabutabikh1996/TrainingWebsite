import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Exercise } from "@/types/admin";

/** The categories the form offers; also drives the filter and the counters. */
export const CATEGORIES = ["مقاومة", "كارديو", "إطالة"] as const;

export interface ExerciseFormValues {
  name_ar: string;
  name_en: string;
  target_muscles: string[];
  category: string;
  video_url: string;
  notes: string;
}

export function useExercises(initialExercises: Exercise[]) {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises || []);

  const [search, setSearch] = useState("");
  /** Target-muscle filter (from the picture strip). */
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  /** Exercise type filter — مقاومة / كارديو / إطالة. */
  const [selectedType, setSelectedType] = useState("الكل");

  const uniqueMuscles = useMemo(() => {
    const m = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.target_muscle) {
        ex.target_muscle.split(",").forEach((muscle) => {
          const trimmed = muscle.trim();
          if (trimmed) m.add(trimmed);
        });
      }
    });
    return ["الكل", ...Array.from(m)];
  }, [exercises]);

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    exercises.forEach((ex) => {
      const c = ex.category || "مقاومة";
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return counts;
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesSearch =
        !term ||
        ex.name_ar.toLowerCase().includes(term) ||
        (ex.name_en?.toLowerCase().includes(term) ?? false) ||
        (ex.target_muscle?.toLowerCase().includes(term) ?? false);

      /* Compare whole entries rather than a substring of the joined string:
         "ظهر" used to also match "أسفل الظهر". */
      const muscles = ex.target_muscle
        ? ex.target_muscle.split(",").map((m) => m.trim())
        : [];
      const matchesMuscle =
        selectedCategory === "الكل" || muscles.includes(selectedCategory);

      const matchesType =
        selectedType === "الكل" || (ex.category || "مقاومة") === selectedType;

      return matchesSearch && matchesMuscle && matchesType;
    });
  }, [exercises, search, selectedCategory, selectedType]);

  const saveExercise = async (formData: ExerciseFormValues, editingEx: Exercise | null) => {
    if (!formData.name_ar.trim()) {
      toast.error("يرجى إدخال اسم التمرين بالعربية");
      return false;
    }
    if (formData.target_muscles.length === 0) {
      toast.error("يرجى اختيار عضلة واحدة على الأقل");
      return false;
    }

    const toastId = toast.loading(editingEx ? "جاري تحديث التمرين..." : "جاري حفظ التمرين...");
    try {
      const payload = {
        name_ar: formData.name_ar.trim(),
        name_en: formData.name_en.trim() || null,
        category: formData.category,
        video_url: formData.video_url.trim() || null,
        notes: formData.notes.trim() || null,
        target_muscle: formData.target_muscles.join(", "),
      };

      const res = await fetch("/api/admin/exercises", {
        method: editingEx ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEx ? { id: editingEx.id, ...payload } : payload),
      });

      if (!res.ok) {
        toast.error("حدث خطأ أثناء الحفظ", { id: toastId });
        return false;
      }

      const savedEx: Exercise = await res.json();
      setExercises((prev) =>
        editingEx
          ? prev.map((ex) => (ex.id === savedEx.id ? savedEx : ex))
          : [savedEx, ...prev]
      );
      toast.success(editingEx ? "تم تحديث التمرين" : "تمت إضافة التمرين", { id: toastId });
      router.refresh();
      return true;
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحفظ", { id: toastId });
      return false;
    }
  };

  const deleteExercise = async (id: string) => {
    const target = exercises.find((ex) => ex.id === id);
    /* Name the exercise — the old prompt said "this exercise" with no clue
       which card the click landed on. */
    if (!confirm(`حذف تمرين «${target?.name_ar ?? ""}» نهائياً؟`)) return;

    const toastId = toast.loading("جاري الحذف...");
    try {
      const res = await fetch(`/api/admin/exercises?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف", { id: toastId });
        return;
      }
      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      toast.success("تم حذف التمرين", { id: toastId });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحذف", { id: toastId });
    }
  };

  return {
    exercises,
    search, setSearch,
    selectedCategory, setSelectedCategory,
    selectedType, setSelectedType,
    uniqueMuscles,
    countsByType,
    filteredExercises,
    saveExercise,
    deleteExercise,
  };
}
