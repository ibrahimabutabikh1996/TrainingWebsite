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
  /** Free-text amount typed by the coach. Absent on items saved before it existed, which keep showing weight + unit. */
  amount?: string;
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
  const sSize = typeof r.serving_size === "string" ? r.serving_size : null;

  return {
    id: toText(r.id) || crypto.randomUUID(),
    refId: toText(r.refId),
    name,
    category: toText(r.category),
    serving_size: sSize,
    qty: rawQty ?? 0,
    weight: w,
    unit: typeof r.unit === "string" && r.unit.trim() ? r.unit : "غرام",
    ...(typeof r.amount === "string" ? { amount: r.amount.slice(0, 200) } : {}),
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

/** Snapshots a library source into a meal item. See MealItem on why it copies. */
export function itemFromSource(source: NutritionSource): MealItem {
  return {
    id: crypto.randomUUID(),
    refId: source.id,
    name: source.name,
    category: source.category,
    serving_size: source.serving_size,
    qty: 0,
    weight: null,
    amount: "",
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
