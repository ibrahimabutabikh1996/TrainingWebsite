import type { Day } from "@/types/admin";
import type { DietPlan } from "@/types/diet";

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
  weightLogs?: { date: string; weight: number }[];
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
  dietCalories?: number | null;
  allergies: string;
  /* The intake questionnaire's meal *times*, not a prescription — kept because
     the dashboard's "profile being prepared" gate still reads it. The diet the
     coach actually prescribes lives in dietPlans. */
  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
  };
  /** The diets the coach built, in slot order. Empty until one is saved. */
  dietPlans: DietPlan[];
  /** The assigned course's days. Each cycle carries its own copy of these. */
  workouts: Day[];
  measurements: JsonRecord | null;
  photos: JsonRecord | null;
  weightLogs?: { date: string; weight: number }[];
  /** The whole intake questionnaire, as the trainee answered it. */
  raw_answers?: JsonRecord;
  /* Returned by /api/profile: true once the subscription is past 30 days.
     The dashboard already branched on it, but the field was missing here, which
     failed the production type check and blocked `next build`. */
  isExpired?: boolean;
  /** Optional fields for trainee dashboard general Home statistics */
  created_at?: string;
  activation_date?: string | null;
  subscription_ends_at?: string | null;
  completedWorkoutDays?: number;
  completedCycles?: number;
  workoutDates?: string[];
  /** Chronological subscription timeline of all months with their assigned workouts and diet plans */
  monthlyHistory?: MonthlyArchive[];
}

export interface MonthlyArchive {
  monthNumber: number;
  monthName: string;
  startDate: string;
  endDate: string;
  status: "completed" | "current" | "upcoming";
  workout: {
    courseId?: string;
    courseName: string;
    daysCount: number;
    daysData: Day[];
  } | null;
  diet: {
    name: string;
    calories?: number | null;
    mealsData: DietPlan[];
  } | null;
}
