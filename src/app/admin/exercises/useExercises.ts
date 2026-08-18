import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Exercise } from "@/types/admin";

/** The categories the form offers; also drives the filter and the counters. */
export const CATEGORIES = ["مقاومة", "كارديو", "اطالة"] as const;

export interface ExerciseFormValues {
  name_ar: string;
  target_muscles: string[];
  category: string;
  video_url: string;
  notes: string;
}

const MUSCLE_GROUPS = [
  "كل التمارين",
  "صدر",
  "ظهر",
  "اكتاف",
  "ذراعين",
  "ارجل",
  "بطن"
];

const MUSCLE_MAPPING: Record<string, string[]> = {
  "صدر": ["صدر", "بنج", "pectoral", "chest"],
  "ظهر": ["ظهر", "مجنص", "ترابيس", "قطني", "latissimus", "back", "traps", "lower back"],
  "اكتاف": ["كتف", "اكتاف", "دالي", "deltoid", "shoulder"],
  "ذراعين": ["باي", "تراي", "سواعد", "ساعد", "ذراع", "bicep", "tricep", "forearm", "arm"],
  "ارجل": ["رجل", "ارجل", "فخذ", "افخاذ", "سمان", "ربلة", "ارداف", "جلوت", "ضام", "مبعد", "رباعي", "خلفيات", "اوتار", "leg", "quad", "hamstring", "glute", "calf"],
  "بطن": ["بطن", "معدة", "خواصر", "مائلة", "abdomin", "abs", "oblique"],
};

export const getStandardMuscleGroups = (rawMuscles: string): string[] => {
  if (!rawMuscles) return [];
  const rawArray = rawMuscles.split(",").map(m => m.trim().toLowerCase());
  const foundGroups = new Set<string>();
  
  rawArray.forEach(raw => {
    let matched = false;
    for (const [group, keywords] of Object.entries(MUSCLE_MAPPING)) {
      if (keywords.some(kw => raw.includes(kw))) {
        foundGroups.add(group);
        matched = true;
      }
    }
    if (!matched && raw) {
      foundGroups.add(raw);
    }
  });
  
  return Array.from(foundGroups);
};

export function useExercises(initialExercises: Exercise[]) {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises || []);

  const [search, setSearch] = useState("");
  /** Target-muscle filter (from the picture strip). */
  const [selectedCategory, setSelectedCategory] = useState("كل التمارين");
  /** Exercise type filter — مقاومة / كارديو / إطالة. */
  const [selectedType, setSelectedType] = useState("الكل");

  const uniqueMuscles = useMemo(() => {
    const m = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.target_muscle) {
        const groups = getStandardMuscleGroups(ex.target_muscle);
        groups.forEach(g => m.add(g));
      }
    });
    
    const standard = MUSCLE_GROUPS.slice(1).filter(g => m.has(g));
    const others = Array.from(m).filter(g => !MUSCLE_GROUPS.includes(g));
    return ["كل التمارين", ...standard, ...others];
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
        (ex.target_muscle?.toLowerCase().includes(term) ?? false);

      const muscles = ex.target_muscle ? getStandardMuscleGroups(ex.target_muscle) : [];
      const matchesMuscle =
        selectedCategory === "كل التمارين" || muscles.includes(selectedCategory);

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

    const toastId = toast.loading(editingEx ? "جارٍ تحديث التمرين..." : "جارٍ حفظ التمرين...");
    try {
      const payload = {
        name_ar: formData.name_ar.trim(),
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

    const toastId = toast.loading("جارٍ الحذف...");
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
