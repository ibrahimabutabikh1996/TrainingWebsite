/* Shape of the subscription form state, shared by the page and its steps.
   Previously each step took `formData: any`, so a typo in a field name failed
   silently at runtime instead of at compile time. */

export interface SubscriptionFormData {
  /* Step 0 — the payment gate that opens the form. Registration only; a
     renewal goes straight to step 1. */
  payment_receipt: File[];

  // Step 1 — basic info
  fullname: string;
  phone: string;
  plan: string;
  plan_type: string;
  gender: "male" | "female";
  age: string;
  weight: string;
  height: string;
  activity: string;
  residence: string;
  employment: string;

  // Step 2 — meal windows & training background
  workday_breakfast: string;
  workday_lunch: string;
  workday_dinner: string;
  holiday_breakfast: string;
  holiday_lunch: string;
  holiday_dinner: string;
  workout_exp: string;
  workout_type_exp: string[];
  workout_type_other_desc: string;
  workout_commit: string;
  workout_days: string;
  gym_time: string;
  /* Only asked when workout_commit is "opt_commit_home". */
  home_equipment_photo: File[];

  // Step 3 — nutrition & goal
  sub_goal: string;
  target_weight: string;
  allergies: string;
  fav_foods: string;
  coffee_rate: string;
  coffee_type: string;
  meat: string;
  buy_supp: string;

  // Step 4 — health & attachments
  injuries: string;
  analysis_file: File[];
  body_photos: File[];
  meas_arm: string;
  meas_waist: string;
  meas_hips: string;
  meas_leg: string;
  supplements_list: string;
  supplements_photo: File[];
  diet_history: string;
  diet_history_file: File[];
  last_diet_fail: string;
  eating_reason: string;

  // Account details
  username?: string;
  password?: string;
}

export interface StepProps {
  formData: SubscriptionFormData;
  /* Patch semantics: steps pass only the keys they change. */
  update: (patch: Partial<SubscriptionFormData>) => void;
  /* True when the visitor arrived on a `?plan=` link, so the plan is already
     decided and the field only displays it. False when they reached /form with
     no plan named — then they have to be able to pick one. */
  planLocked?: boolean;
}
