import type { Day } from "@/types/admin";

/**
 * A stored JSON blob whose keys the code reads by name: the intake questionnaire,
 * a set of measurements, the landing-page content.
 *
 * Deliberately not modelled field by field. Its shape is decided by whichever
 * version of the form last wrote it, and older rows were written by older
 * versions — a fixed interface here would describe one past moment of the form
 * and drift quietly out of step with the rows it claims to type. Read the keys
 * you need and give them a default.
 *
 * This is the one place in the project allowed to hold an unchecked value; every
 * other `any` was replaced by it so there is a single, documented escape hatch
 * rather than fifty scattered ones.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonRecord = Record<string, any>;

export interface Meal {
  time: string;
  desc: string;
}

export interface ProfileData {
  fullname?: string;
  plan?: string;
  age?: number | string;
  weight?: number | string;
  height?: number | string;
  activity?: string;
  goal?: string;
  gender?: string;
  dietCalories?: number;
  allergies?: string;
  measurements?: JsonRecord | null;
  photos?: JsonRecord | null;
}

export interface CourseData {
  meals?: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
  };
  workouts?: Day[];
}

export interface UserProfile {
  id: string;
  fullname: string;
  plan: string;
  age: number | string;
  weight: number | string;
  height: number | string;
  activity: string;
  goal: string;
  gender: string;
  dietCalories: number;
  allergies: string;
  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
  };
  /** The assigned course's days. Each cycle carries its own copy of these. */
  workouts: Day[];
  measurements: JsonRecord | null;
  photos: JsonRecord | null;
  /** The whole intake questionnaire, as the trainee answered it. */
  raw_answers?: JsonRecord;
  /* Returned by /api/profile: true once the subscription is past 30 days.
     The dashboard already branched on it, but the field was missing here, which
     failed the production type check and blocked `next build`. */
  isExpired?: boolean;
}
