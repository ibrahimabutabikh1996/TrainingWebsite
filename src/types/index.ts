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
  measurements?: any;
  photos?: any;
}

export interface CourseData {
  meals?: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
  };
  workouts?: any[];
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
  workouts: any[];
  measurements: any;
  photos: any;
}
