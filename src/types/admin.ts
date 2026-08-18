export type Profile = {
  id: string;
  username: string;
  created_at: string | Date;
  /* Real column, not a key inside `data` — it gates login, so it needs a type. */
  is_suspended?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; 
};

/* Minimal shape the course builder needs for its trainee dropdown — deliberately
   excludes the intake `data` blob so it never reaches the client. */
export type TraineeOption = {
  id: string;
  name: string;
  username: string;
};

export type Exercise = {
  id: string;
  name_ar: string;
  target_muscle: string | null;
  video_url: string | null;
  notes: string | null;
  category: string | null;
};

/**
 * One exercise inside a saved programme.
 *
 * `name_ar` and `target_muscle` are deliberately COPIED from the exercise
 * library at the moment the coach adds them, rather than joined on `refId`.
 * A programme is a point-in-time document: renaming or retargeting an exercise
 * in the library must not silently rewrite programmes already handed to
 * trainees. `refId` is kept only to trace the origin — it has no foreign key,
 * so it may point at a library row that was since deleted, and nothing here
 * should assume it still resolves.
 *
 * If the intent ever changes to "programmes track the library", drop these two
 * copied fields and resolve names through `refId` at read time instead.
 */
export type DayExercise = {
  id: string;
  refId?: string;
  name?: string;
  name_ar?: string;
  target_muscle?: string;
  /* Copied from the library alongside the name, for the same reason — see
     `useCourseBuilder`, which writes it when the coach adds the exercise. It
     was missing from this type while being written and read, so the export
     sheet had to reach for it through a cast. Rows saved before it existed do
     not carry it; the export falls back to a live lookup by `refId`. */
  video_url?: string | null;
  sets?: number;
  reps?: string[] | string | number;
  rest_from?: string;
  rest_from_unit?: string;
  rest_to?: string;
  rest_to_unit?: string;
  rest_time?: string;
  notes?: string;
  is_custom?: boolean;
  custom_col_1?: string;
  custom_col_2?: string;
  custom_col_3?: string;
  custom_col_4?: string;
};

export type Day = {
  id: string;
  name?: string;
  title?: string;
  /* The muscle groups this day targets, chosen by the coach. Optional so older
     courses saved before this field still parse — read it as `?? []`. Stored in
     the jsonb days_data alongside the exercises, so no migration is involved. */
  muscles?: string[];
  exercises: DayExercise[];
};



export type Course = {
  id: string;
  name: string;
  created_at: Date | string;
  description?: string;
  trainee_id?: string;
  /* Persisted as jsonb, so treat it as unstructured on read and narrow with
     asDays() before walking it — older rows predate the current shape. */
  days_data?: unknown;
};

/* Names of the trainees a course is currently assigned to, keyed by course id. */
export type CourseAssignments = Record<string, string[]>;

/**
 * A "custom" row is a free-text line the coach writes themselves: a title plus
 * four columns they define. It is not a library exercise and carries no sets,
 * reps or rest — the builder creates it with nothing but `is_custom` and the
 * four columns, and library rows always carry a `refId`.
 *
 * It lives here, beside the types, because the editor, the course library and
 * the PDF export all have to agree on the answer. Each of them used to decide
 * for itself, which is how the export came to print a 3×10 and a 60–90s rest
 * for rows that never had either.
 */
export function isCustomExercise(ex: Partial<DayExercise> | null | undefined): boolean {
  return !!ex && (ex.is_custom === true || !ex.refId);
}

/** Narrows a jsonb days_data blob to the day list, tolerating legacy rows. */
export function asDays(raw: unknown): Day[] {
  if (!Array.isArray(raw)) return [];
  
  // Backward compatibility: If the array contains 'days', it's a legacy Week array
  if (raw.length > 0 && 'days' in raw[0]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.flatMap((week: any) => week.days || []);
  }

  return raw.filter((d): d is Day => !!d && typeof d === "object") as Day[];
}

/** Total training days. */
export function countDays(raw: unknown): number {
  return asDays(raw).length;
}

/**
 * A library course as the builder's "start from an existing course" list shows
 * it: enough to recognise and choose one, and no `days_data`.
 *
 * The blob stays on the server deliberately. The list is every course the coach
 * has ever built, and shipping all of their days to the browser to render a
 * name and two numbers would grow with the library forever — the counts are
 * taken where the rows are read, and the days of the one course that gets
 * picked are fetched on its own.
 */
export type CourseTemplate = {
  id: string;
  name: string;
  description: string;
  days: number;
  exercises: number;
  created_at: string;
};

/** Total exercises across every day. */
export function countExercises(raw: unknown): number {
  return asDays(raw).reduce(
    (sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0),
    0
  );
}

export type NutritionSource = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  serving_size: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  notes: string | null;
  created_at: Date | string | null;
};

