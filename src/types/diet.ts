import type { NutritionSource } from "./admin";
import type { IconName } from "@/components/Icon";

/** How many plans one trainee may hold — a training-day diet and a rest-day one. */
export const MAX_PLANS_PER_TRAINEE = 2;

/* Ordinals rather than digits: "النظام 2" reads as a serial number, not as the
   second of two. Falls back to the digit past the list so raising
   MAX_PLANS_PER_TRAINEE never produces an empty label. */
const PLAN_ORDINALS = ["النظام الغذائي الاختيار الأول", "النظام الغذائي الاختيار الثاني", "النظام الغذائي الاختيار الثالث"];

/** Default label for a plan in slot `position`. */
export function defaultPlanName(position: number) {
  return PLAN_ORDINALS[position - 1] ?? `النظام ${position}`;
}

/**
 * One prescribed food item inside a meal.
 */
export type MealItem = {
  id: string;
  refId: string;
  name: string;
  category: string;
  serving_size: string | null;
  qty: number;
  weight?: number | null;
  unit?: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
};

export function getServingBaseGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const match = servingSize.match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (val > 0) return val;
  }
  return 100;
}

export type Meal = {
  id: string;
  name: string;
  time: string;
  startNote: string;
  note: string;
  items: MealItem[];
};

export type MealsData = Meal[];

export type DietPlan = {
  id: string;
  name: string;
  position: number;
  meals: MealsData;
};

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0 };

/** Finite, non-negative, or null. Guards both hand-edited jsonb and form input. */
function toNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function toText(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function normalizeItem(raw: unknown): MealItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = toText(r.name).trim();
  if (!name) return null; // An item with no name is not an item.

  const rawQty = toNumberOrNull(r.qty);
  const w = toNumberOrNull(r.weight);
  const finalQty = rawQty != null && rawQty >= 0 ? rawQty : (w != null && w > 0 ? 0 : 1);
  const sSize = typeof r.serving_size === "string" ? r.serving_size : null;
  const finalWeight = w != null && w >= 0 ? w : (finalQty > 0 ? finalQty * getServingBaseGrams(sSize) : 0);

  return {
    id: toText(r.id) || crypto.randomUUID(),
    refId: toText(r.refId),
    name,
    category: toText(r.category),
    serving_size: sSize,
    qty: finalQty,
    weight: finalWeight,
    unit: typeof r.unit === "string" && r.unit.trim() ? r.unit : "غرام",
    calories: toNumberOrNull(r.calories),
    protein: toNumberOrNull(r.protein),
    carbs: toNumberOrNull(r.carbs),
    fats: toNumberOrNull(r.fats),
  };
}

/**
 * Narrows a jsonb meals_data blob to the dynamic meal array.
 */
export function asMeals(raw: unknown): MealsData {
  if (!Array.isArray(raw)) return [];
  
  return raw.map((slot) => {
    if (!slot || typeof slot !== "object") return null;
    const s = slot as Record<string, unknown>;
    
    // name is required; fallback if missing for legacy
    const mealName = toText(s.name).trim() || "وجبة";
    
    return {
      id: toText(s.id) || crypto.randomUUID(),
      name: mealName,
      time: toText(s.time).slice(0, 40),
      startNote: toText(s.startNote).slice(0, 500),
      note: toText(s.note).slice(0, 500),
      items: Array.isArray(s.items)
        ? s.items.map(normalizeItem).filter((i): i is MealItem => i !== null)
        : [],
    };
  }).filter((m): m is Meal => m !== null);
}

/** Macros for the prescribed amount of one item — calculated strictly by weight when > 0, otherwise by qty multiplier when > 0. */
export function itemMacros(item: MealItem): Macros {
  const baseGrams = getServingBaseGrams(item.serving_size);
  const ratio = item.weight != null && item.weight > 0
    ? item.weight / baseGrams
    : (item.qty > 0 ? item.qty : 0);

  return {
    calories: (item.calories ?? 0) * ratio,
    protein: (item.protein ?? 0) * ratio,
    carbs: (item.carbs ?? 0) * ratio,
    fats: (item.fats ?? 0) * ratio,
  };
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fats: a.fats + b.fats,
  };
}

export function mealTotals(meal: Meal): Macros {
  return meal.items.reduce((sum, item) => addMacros(sum, itemMacros(item)), { ...ZERO_MACROS });
}

/** Whole-day totals across all meals. */
export function planTotals(meals: MealsData): Macros {
  return meals.reduce(
    (sum, meal) => addMacros(sum, mealTotals(meal)),
    { ...ZERO_MACROS }
  );
}

/** Trailing zeros dropped: "120" not "120.0", but "12.5" survives. */
export function fmtMacro(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 10) / 10);
}

export function countItems(meals: MealsData): number {
  return meals.reduce((n, meal) => n + meal.items.length, 0);
}

/** Snapshots a library source into a meal item. See MealItem on why it copies. */
export function itemFromSource(source: NutritionSource, qty = 1): MealItem {
  return {
    id: crypto.randomUUID(),
    refId: source.id,
    name: source.name,
    category: source.category,
    serving_size: source.serving_size,
    qty,
    weight: getServingBaseGrams(source.serving_size) * qty,
    unit: "غرام",
    calories: source.calories,
    protein: source.protein,
    carbs: source.carbs,
    fats: source.fats,
  };
}

export function normalizeFoodCategory(category?: string): string {
  if (category === "مصادر الخضراوات") return "الخضراوات";
  if (category === "مصادر الفواكه") return "الفواكه";
  return category || "";
}

export function getCategoryBadge(category: string): { icon: IconName; image: string; color: string; bg: string; border: string; label: string } {
  const monoStyle = {
    color: "var(--mono-icon-color)",
    bg: "color-mix(in srgb, var(--mono-icon-color) 8%, transparent)",
    border: "color-mix(in srgb, var(--mono-icon-color) 22%, transparent)",
  };
  switch (category) {
    case "مصادر البروتين":
      return { icon: "food_protein", image: "/images/food/مصادر البروتين.png", ...monoStyle, label: "مصادر البروتين" };
    case "مصادر الكاربوهيدرات":
      return { icon: "food_carbs", image: "/images/food/مصادر الكاربوهيدرات.png", ...monoStyle, label: "مصادر الكاربوهيدرات" };
    case "مصادر الدهون الصحية":
    case "مصادر الدهون":
      return { icon: "food_fats", image: "/images/food/مصادر الدهون.png", ...monoStyle, label: "مصادر الدهون الصحية" };
    case "الخضراوات":
    case "مصادر الخضراوات":
      return { icon: "food_veggies", image: "/images/food/الخضراوات.png", ...monoStyle, label: "الخضراوات" };
    case "الفواكه":
    case "مصادر الفواكه":
      return { icon: "food_fruit", image: "/images/food/الفواكه.png", ...monoStyle, label: "الفواكه" };
    default:
      return { icon: "restaurant_menu", image: "/images/food/مصادر البروتين.png", ...monoStyle, label: category || "صنف غذائي" };
  }
}
