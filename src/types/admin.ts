export type Profile = {
  id: string;
  username: string;
  created_at: string | Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; 
};

export type Exercise = {
  id: string;
  name_ar: string;
  name_en: string | null;
  target_muscle: string | null;
  video_url: string | null;
  notes: string | null;
  category: string | null;
};

export type DayExercise = {
  id: string;
  refId: string;
  name_ar: string;
  target_muscle: string;
  sets: number;
  reps: string[];
};

export type Day = {
  id: string;
  exercises: DayExercise[];
};

export type Week = {
  id: string;
  days: Day[];
};

export type Course = {
  id: string;
  name: string;
  created_at: Date | string;
  description?: string;
  trainee_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  days_data?: any;
};
