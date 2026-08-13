import type { NutritionSource } from "./admin";
import type { IconName } from "@/components/Icon";

/**
 * The five meal slots, in the order the trainee eats them.
 *
 * They are fixed by the plan's definition, not by data: every plan has exactly
 * these five, and an empty slot is simply one with no items. Order therefore
 * lives here rather than in a per-meal position field, and adding a sixth meal
 * is an edit to this array — no migration, since meals_data is jsonb.
 *
 * The two snacks are separate keys on purpose. They share a label root but not
 * their contents, and keying both as "snack" would silently merge them.
 */
export const MEAL_SLOTS = [
  { key: "breakfast", label: "وجبة الفطور", icon: "restaurant_menu" },
  { key: "snack1", label: "وجبة السناك الأولى", icon: "restaurant_menu" },
  { key: "lunch", label: "وجبة الغداء", icon: "restaurant_menu" },
  { key: "snack2", label: "وجبة السناك الثانية", icon: "restaurant_menu" },
  { key: "dinner", label: "وجبة العشاء", icon: "restaurant_menu" },
] as const;

export type MealSlotKey = (typeof MEAL_SLOTS)[number]["key"];

export const MEAL_SLOT_KEYS = MEAL_SLOTS.map((s) => s.key) as MealSlotKey[];

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
 *
 * `name`, `category`, `serving_size` and the four macro fields are COPIED from
 * the nutrition library the moment the coach adds the item — the same rule
 * DayExercise follows for exercise names. A plan is a point-in-time document:
 * editing a source's macros, or deleting it, must not rewrite plans already
 * handed to trainees. `refId` traces the origin only; it has no foreign key and
 * may point at a library row that no longer exists.
 *
 * Macros are stored PER ONE SERVING of `serving_size`. Multiply by `qty` to get
 * the prescribed amount — storing the multiplied value instead would compound
 * every time the coach edited the quantity.
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
  /** Free text — not every coach prescribes a clock time. */
  time: string;
  note: string;
  items: MealItem[];
};

export type MealsData = Record<MealSlotKey, Meal>;

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

export function emptyMeal(): Meal {
  return { time: "", note: "", items: [] };
}

export function emptyMeals(): MealsData {
  return Object.fromEntries(
    MEAL_SLOT_KEYS.map((k) => [k, emptyMeal()])
  ) as MealsData;
}

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
 * Narrows a jsonb meals_data blob to the five slots.
 *
 * Tolerant by design: it fills in missing slots, drops unknown keys, and
 * discards malformed items rather than throwing. A plan that fails to parse
 * would otherwise take the whole trainee page down. Also used server-side to
 * sanitize what the browser submits — the client is not trusted to have kept
 * the shape.
 */
export function asMeals(raw: unknown): MealsData {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = emptyMeals();

  for (const key of MEAL_SLOT_KEYS) {
    const slot = source[key];
    if (!slot || typeof slot !== "object") continue;
    const s = slot as Record<string, unknown>;
    out[key] = {
      time: toText(s.time).slice(0, 40),
      note: toText(s.note).slice(0, 500),
      items: Array.isArray(s.items)
        ? s.items.map(normalizeItem).filter((i): i is MealItem => i !== null)
        : [],
    };
  }

  return out;
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

/** Whole-day totals across the five slots. */
export function planTotals(meals: MealsData): Macros {
  return MEAL_SLOT_KEYS.reduce(
    (sum, key) => addMacros(sum, mealTotals(meals[key])),
    { ...ZERO_MACROS }
  );
}

/** Trailing zeros dropped: "120" not "120.0", but "12.5" survives. */
export function fmtMacro(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 10) / 10);
}

export function countItems(meals: MealsData): number {
  return MEAL_SLOT_KEYS.reduce((n, key) => n + meals[key].items.length, 0);
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
    color: "var(--mono-icon-color, #FFFFFF)",
    bg: "color-mix(in srgb, var(--mono-icon-color, #FFFFFF) 8%, transparent)",
    border: "color-mix(in srgb, var(--mono-icon-color, #FFFFFF) 22%, transparent)",
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
