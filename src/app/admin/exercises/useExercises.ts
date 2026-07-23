import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Exercise } from "@/types/admin";

export function useExercises(initialExercises: Exercise[]) {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises || []);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  // Extract unique categories (muscles) for filters
  const uniqueMuscles = useMemo(() => {
    const m = new Set<string>();
    exercises.forEach(ex => {
      if (ex.target_muscle) {
        ex.target_muscle.split(",").forEach(muscle => m.add(muscle.trim()));
      }
    });
    return ["الكل", ...Array.from(m)];
  }, [exercises]);

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name_ar.toLowerCase().includes(search.toLowerCase()) || 
                          (ex.name_en && ex.name_en.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === "الكل" || (ex.target_muscle && ex.target_muscle.includes(selectedCategory));
    return matchesSearch && matchesCat;
  });

  const saveExercise = async (formData: any, editingEx: Exercise | null) => {
    if (!formData.name_ar) {
      alert("يرجى إدخال اسم التمرين بالعربية");
      return false;
    }
    if (formData.target_muscles.length === 0) {
      alert("يرجى اختيار عضلة واحدة على الأقل");
      return false;
    }
    
    try {
      const url = "/api/admin/exercises";
      const method = editingEx ? "PUT" : "POST";
      
      const payload = {
        name_ar: formData.name_ar,
        name_en: formData.name_en,
        category: formData.category,
        video_url: formData.video_url,
        notes: formData.notes,
        target_muscle: formData.target_muscles.join(", ")
      };
      
      const finalPayload = editingEx ? { id: editingEx.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });

      if (res.ok) {
        const savedEx = await res.json();
        if (editingEx) {
          setExercises(exercises.map(ex => ex.id === savedEx.id ? savedEx : ex));
        } else {
          setExercises([savedEx, ...exercises]);
        }
        router.refresh();
        return true;
      } else {
        alert("حدث خطأ أثناء الحفظ");
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ");
      return false;
    }
  };

  const deleteExercise = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التمرين؟")) return;
    try {
      const res = await fetch(`/api/admin/exercises?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setExercises(exercises.filter(ex => ex.id !== id));
        router.refresh();
      } else {
        alert("فشل الحذف");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    exercises,
    search, setSearch,
    selectedCategory, setSelectedCategory,
    uniqueMuscles,
    filteredExercises,
    saveExercise,
    deleteExercise
  };
}
