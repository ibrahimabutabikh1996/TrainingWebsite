import { useState } from "react";
import { Day, DayExercise, Exercise } from "@/types/admin";

/* Collision-free ids. Date.now() was used before, which hands out the same id
   to two weeks/days/exercises created in the same millisecond — and since
   deleteWeek and removeExercise match by id, deleting one then removed both. */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const MIN_SETS = 1;
const MAX_SETS = 10;

/**
 * Courses saved by older builds may be missing the ids the editor keys off, so
 * backfill them on load — without ids every day renders under the same React
 * key and every mutation targets the wrong row.
 */
export function normalizeDays(raw: unknown): Day[] {
  if (!Array.isArray(raw)) return [];
  
  // Flatten legacy weeks if present
  let items = raw;
  if (raw.length > 0 && 'days' in raw[0]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items = raw.flatMap((week: any) => week.days || []);
  }

  return items.map((day: Partial<Day>) => ({
    id: day?.id || newId(),
    exercises: Array.isArray(day?.exercises)
      ? day.exercises.map((ex: Partial<DayExercise>) => ({
          id: ex?.id || newId(),
          refId: ex?.refId || "",
          name_ar: ex?.name_ar || "",
          target_muscle: ex?.target_muscle || "",
          sets: typeof ex?.sets === "number" ? ex.sets : (ex?.reps?.length ?? 3),
          reps: Array.isArray(ex?.reps) ? ex.reps : ["10", "10", "10"],
        }))
      : [],
  }));
}

export interface CourseBuilderInit {
  name?: string;
  description?: string;
  traineeId?: string;
  days?: Day[];
}

/* State is seeded from the initial values rather than synced in an effect.
   The effect version left the trainee <select> stuck on "كورس عام": the server
   rendered the placeholder option as selected, and the post-hydration state
   change never propagated to the select's DOM selection. */
export function useCourseBuilder(init: CourseBuilderInit = {}) {
  const [courseName, setCourseName] = useState(init.name ?? "");
  const [courseDesc, setCourseDesc] = useState(init.description ?? "");
  const [selectedTrainee, setSelectedTrainee] = useState(init.traineeId ?? "");
  const [days, setDays] = useState<Day[]>(init.days ?? []);

  /* All mutations go through the updater form. Reading `days` from the render
     closure dropped updates whenever two edits landed in the same tick. */
  const mapDay = (dayId: string, fn: (day: Day) => Day) =>
    setDays((prev) => prev.map((d) => (d.id === dayId ? fn(d) : d)));

  const mapExercise = (
    dayId: string,
    exId: string,
    fn: (ex: DayExercise) => DayExercise
  ) =>
    mapDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((ex) => (ex.id === exId ? fn(ex) : ex)),
    }));

  const addDay = () => setDays((prev) => [...prev, { id: newId(), exercises: [] }]);

  const deleteDay = (dayId: string) =>
    setDays((prev) => prev.filter((d) => d.id !== dayId));

  const addExerciseToDay = (dayId: string, ex: Exercise) =>
    mapDay(dayId, (d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          id: newId(),
          refId: ex.id,
          name_ar: ex.name_ar,
          target_muscle: ex.target_muscle || "",
          sets: 3,
          reps: ["10", "10", "10"],
        },
      ],
    }));

  const removeExercise = (dayId: string, exId: string) =>
    mapDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.filter((ex) => ex.id !== exId),
    }));

  const updateSets = (dayId: string, exId: string, newSetsStr: string) => {
    /* Clamped to at least one set to match the input's min: parseInt("") fell
       through to 0, which silently threw away every rep the coach had entered. */
    const parsed = parseInt(newSetsStr, 10);
    const nextSets = Number.isNaN(parsed)
      ? MIN_SETS
      : Math.min(MAX_SETS, Math.max(MIN_SETS, parsed));

    mapExercise(dayId, exId, (ex) => {
      const reps = [...ex.reps];
      while (reps.length < nextSets) reps.push(reps[reps.length - 1] || "10");
      return { ...ex, sets: nextSets, reps: reps.slice(0, nextSets) };
    });
  };

  const updateRep = (
    dayId: string,
    exId: string,
    repIndex: number,
    newValue: string
  ) =>
    mapExercise(dayId, exId, (ex) => {
      const reps = [...ex.reps];
      reps[repIndex] = newValue;
      return { ...ex, reps };
    });

  /* Summary for the header, so the coach can see the program size at a glance. */
  const totals = {
    days: days.length,
    exercises: days.reduce((n, d) => n + d.exercises.length, 0)
  };

  return {
    courseName, setCourseName,
    courseDesc, setCourseDesc,
    selectedTrainee, setSelectedTrainee,
    days, setDays,
    addDay, deleteDay,
    addExerciseToDay, updateSets, updateRep, removeExercise,
    totals,
  };
}
