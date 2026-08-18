import { useState } from "react";
import { Day, DayExercise, Exercise, isCustomExercise } from "@/types/admin";

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

export function formatRestTime(from?: string, fromUnit?: string, to?: string, toUnit?: string): string {
  const fVal = (from || "").trim();
  const fUnit = fromUnit || "ثانية";
  const tVal = (to || "").trim();
  const tUnit = toUnit || "ثانية";

  if (fVal && tVal) {
    if (fUnit === tUnit && fVal === tVal) {
      return `${fVal} ${fUnit}`;
    }
    return `من ${fVal} ${fUnit} إلى ${tVal} ${tUnit}`;
  } else if (fVal) {
    return `${fVal} ${fUnit}`;
  } else if (tVal) {
    return `${tVal} ${tUnit}`;
  }
  return "";
}

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

  /* Spread first, then backfill. This used to build each day and exercise from
     a fixed list of fields, which made it a whitelist: anything not named was
     dropped the moment a saved course was reopened. `custom_col_1`–`4` were the
     visible casualty — the coach typed into the four extra columns, saved, and
     reopened to find them blank — but `notes`, `is_custom` and the day's
     `name`/`title` went the same way. days_data is a jsonb blob the editor round
     trips wholesale, so preserving unknown keys is the correct default. */
  return items.map((day: Partial<Day>) => ({
    ...day,
    id: day?.id || newId(),
    muscles: Array.isArray(day?.muscles)
      ? day.muscles.filter((m): m is string => typeof m === "string" && m.trim() !== "")
      : [],
    exercises: Array.isArray(day?.exercises)
      ? day.exercises.map((ex: Partial<DayExercise>) => {
          const base = {
            ...ex,
            id: ex?.id || newId(),
            name_ar: ex?.name_ar || "",
          };
          /* A custom row has no sets, reps or rest to fall back to. Applying
             the library defaults here is what turned every saved custom row
             into a 3×10 exercise resting 60–90 seconds — values the coach
             never typed, shown as if they had. */
          if (isCustomExercise(ex)) {
            const custom: Partial<DayExercise> = { ...base };
            /* Rows saved before this fix already have those defaults baked into
               the stored jsonb, so drop them on the way in too — otherwise the
               invented numbers survive here and get written straight back out
               on the next save. */
            delete custom.sets;
            delete custom.reps;
            delete custom.rest_from;
            delete custom.rest_from_unit;
            delete custom.rest_to;
            delete custom.rest_to_unit;
            delete custom.rest_time;
            return {
              ...custom,
              id: base.id,
              is_custom: true,
              custom_col_1: ex?.custom_col_1 || "",
              custom_col_2: ex?.custom_col_2 || "",
              custom_col_3: ex?.custom_col_3 || "",
              custom_col_4: ex?.custom_col_4 || "",
            };
          }
          return {
            ...base,
            refId: ex?.refId || "",
            target_muscle: ex?.target_muscle || "",
            sets: typeof ex?.sets === "number" ? ex.sets : (Array.isArray(ex?.reps) ? ex.reps.length : 3),
            reps: Array.isArray(ex?.reps) ? ex.reps : ["10", "10", "10"],
            rest_from: ex?.rest_from || "60",
            rest_from_unit: ex?.rest_from_unit || "ثانية",
            rest_to: ex?.rest_to || "90",
            rest_to_unit: ex?.rest_to_unit || "ثانية",
            rest_time: ex?.rest_time || "من 60 ثانية إلى 90 ثانية",
          };
        })
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

  const addDay = () => {
    const id = newId();
    setDays((prev) => [...prev, { id, muscles: [], exercises: [] }]);
    return id;
  };

  const deleteDay = (dayId: string) =>
    setDays((prev) => prev.filter((d) => d.id !== dayId));

  /* Days are numbered by position, so ordering them is the only way to say
     "leg day comes before push day". Moving past either end is a no-op rather
     than a wrap-around. */
  const moveDay = (dayId: string, direction: -1 | 1) =>
    setDays((prev) => {
      const from = prev.findIndex((d) => d.id === dayId);
      if (from === -1) return prev;
      const to = from + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  /* The muscle groups a day targets. Deduped and trimmed here so the picker
     never has to guard against blanks or repeats. */
  const setDayMuscles = (dayId: string, muscles: string[]) =>
    mapDay(dayId, (d) => ({
      ...d,
      muscles: [...new Set(muscles.map((m) => m.trim()).filter(Boolean))],
    }));

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
          video_url: ex.video_url || null,
          sets: 3,
          reps: ["10", "10", "10"],
          rest_from: "60",
          rest_from_unit: "ثانية",
          rest_to: "90",
          rest_to_unit: "ثانية",
          rest_time: "من 60 ثانية إلى 90 ثانية",
        },
      ],
    }));

  const addCustomExerciseToDay = (dayId: string) =>
    mapDay(dayId, (d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          id: newId(),
          is_custom: true,
          custom_col_1: "",
          custom_col_2: "",
          custom_col_3: "",
          custom_col_4: "",
        },
      ],
    }));

  const removeExercise = (dayId: string, exId: string) =>
    mapDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.filter((ex) => ex.id !== exId),
    }));

  /* Exercise order inside a day is the order the trainee performs them, so it
     has to be editable after the fact — the library only ever appends. */
  const moveExercise = (dayId: string, exId: string, direction: -1 | 1) =>
    mapDay(dayId, (d) => {
      const from = d.exercises.findIndex((ex) => ex.id === exId);
      if (from === -1) return d;
      const to = from + direction;
      if (to < 0 || to >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[from], exercises[to]] = [exercises[to], exercises[from]];
      return { ...d, exercises };
    });

  const updateSets = (dayId: string, exId: string, newSetsStr: string) => {
    /* Clamped to at least one set to match the input's min: parseInt("") fell
       through to 0, which silently threw away every rep the coach had entered. */
    const parsed = parseInt(newSetsStr, 10);
    const nextSets = Number.isNaN(parsed)
      ? MIN_SETS
      : Math.min(MAX_SETS, Math.max(MIN_SETS, parsed));

    mapExercise(dayId, exId, (ex) => {
      const reps = Array.isArray(ex.reps) ? [...ex.reps] : [];
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
      const reps = Array.isArray(ex.reps) ? [...ex.reps] : [];
      reps[repIndex] = newValue;
      return { ...ex, reps };
    });

  const updateCustomTitle = (dayId: string, exId: string, title: string) =>
    mapExercise(dayId, exId, (ex) => ({
      ...ex,
      name_ar: title,
    }));

  const updateCustomCol = (
    dayId: string,
    exId: string,
    col: 1 | 2 | 3 | 4,
    value: string
  ) =>
    mapExercise(dayId, exId, (ex) => ({
      ...ex,
      [`custom_col_${col}`]: value,
    }));

  /* Most exercises use one rep target for every set, so typing it once and
     spreading it beats editing 3–5 identical boxes. */
  const applyRepsToAll = (dayId: string, exId: string, value: string) =>
    mapExercise(dayId, exId, (ex) => {
      const count = Array.isArray(ex.reps) ? ex.reps.length : ex.sets ?? MIN_SETS;
      return { ...ex, reps: Array.from({ length: count }, () => value) };
    });

  const updateRestTime = (
    dayId: string,
    exId: string,
    field: "rest_from" | "rest_from_unit" | "rest_to" | "rest_to_unit",
    value: string
  ) =>
    mapExercise(dayId, exId, (ex) => {
      const updated = { ...ex, [field]: value };
      const rest_time = formatRestTime(
        updated.rest_from,
        updated.rest_from_unit,
        updated.rest_to,
        updated.rest_to_unit
      );
      return { ...updated, rest_time };
    });

  /* One tap for the rest windows coaches actually use, instead of four controls.
     Writes both ends at once so rest_time is derived from the final values. */
  const applyRestPreset = (
    dayId: string,
    exId: string,
    from: string,
    to: string,
    unit: string
  ) =>
    mapExercise(dayId, exId, (ex) => ({
      ...ex,
      rest_from: from,
      rest_from_unit: unit,
      rest_to: to,
      rest_to_unit: unit,
      rest_time: formatRestTime(from, unit, to, unit),
    }));

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
    addDay, deleteDay, moveDay, setDayMuscles,
    addExerciseToDay, addCustomExerciseToDay,
    updateSets, updateRep, applyRepsToAll, updateCustomCol, updateCustomTitle,
    removeExercise, moveExercise, updateRestTime, applyRestPreset,
    totals,
  };
}
