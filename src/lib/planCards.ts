import type { JsonRecord } from "@/types";

/* The membership and offer cards, read as lists rather than as numbered fields.
 *
 * Both sections used to be a fixed set of keys per card — `card1_p1_label`,
 * `card1_p1_val`, `card1_p2_label` … up to a third row, then `card1_f1` to
 * `card1_f3`. The count was decided in the markup, so the coach could not add a
 * fourth service or remove a third feature, and the panel had to be told how
 * many rows each card carried. It disagreed with the page about that: the panel
 * offered two price rows for the second plan while the page rendered three, so
 * `card2_p3_label` has been on the site with nothing in the content manager
 * able to change it.
 *
 * The shape below is one list per card, which is what the section always was.
 * `card3_note` stops being the one card's special case and becomes a field any
 * card may carry.
 *
 * Nothing here writes. The reader takes whatever the row holds — the new lists
 * where they exist, the old numbered keys where they do not — so a stored
 * document that has never been saved through the new editor still renders, and
 * the migration happens the first time the coach saves rather than as a script
 * against the database.
 */

/* The copy these cards fall back to, and the reason it is here rather than
 * beside the markup that used to hold it.
 *
 * The page kept these as part of its own baseline object and the content
 * manager kept a shorter copy of its own — 29 card keys against the page's 70,
 * with every offer default missing from the panel's. That was harmless while
 * the panel only used its copy for placeholder text. It stops being harmless
 * the moment the panel has to READ these: the editor would have shown two rows
 * for the second plan where the page renders three, and nothing at all for two
 * of the offer cards, and the first save would have written that back — deleting
 * content that is live on the site.
 *
 * One copy, imported by both, so the editor and the page cannot disagree about
 * what a card contains. */
export const CARD_LIST_DEFAULTS: JsonRecord = {
  card1_p1_label: "عرض جدول تدريب + نظام غذائي",
  card1_p1_val: "25,000 د.ع",
  card1_p2_label: "جدول تدريب فقط",
  card1_p2_val: "15,000 د.ع",
  card1_p3_label: "نظام غذائي فقط",
  card1_p3_val: "15,000 د.ع",
  card1_f1: "جدول تدريب ممتاز",
  card1_f2: "نظام غذائي ممتاز",
  card1_f3: "اعتمد على نفسك",
  card2_p1_label: "الشهر الأول",
  card2_p1_val: "50,000 د.ع",
  card2_p2_label: "الشهر الثاني (تجديد)",
  card2_p2_val: "30,000 د.ع",
  card2_p3_label: "الشهر الثالث (يتضمن دليل ما بعد الدايت)",
  card2_p3_val: "50,000 د.ع",
  card2_f1: "قواعد غذائية خاصة",
  card2_f2: "خطة المتابعة الأسبوعية",
  card2_f3: "تنظيم أسلوب حياتك",
  card3_p1_label: "خطة نظام غذائي كاملة لمدة 3 أشهر",
  card3_p1_val: "300,000 د.ع",
  card3_p2_label: "دفع شهري (شهر واحد)",
  card3_p2_val: "120,000 د.ع",
  card3_note: "إذا واصلت بالدفع الشهري، ستحصل على خصم 60,000 د.ع في الشهر الثالث.",
  card3_f1: "خطة المتابعة اليومية",
  card3_f2: "التزام مضمون",
  card3_f3: "أضمن طريق للوصول لهدفك",
  off_card1_p1_label: "نظام غذائي ورياضي + خطة المتابعة اليومية",
  off_card1_p1_val: "30,000 د.ع",
  off_card1_p2_label: "نظام غذائي فقط",
  off_card1_p2_val: "20,000 د.ع",
  off_card1_p3_label: "نظام رياضي فقط",
  off_card1_p3_val: "15,000 د.ع",
  off_card1_f1: "جدول تدريبي مخصص",
  off_card1_f2: "نظام غذائي متكامل",
  off_card1_f3: "متابعة على مدار اليوم",
  off_card2_p1_label: "المبلغ كامل",
  off_card2_p1_val: "40,000 د.ع",
  off_card2_p2_label: "القسط الاول (مقدم)",
  off_card2_p2_val: "25,000 د.ع",
  off_card2_p3_label: "القسط الثاني (يدفع بعد 15 يوم من الاشتراك)",
  off_card2_p3_val: "15,000 د.ع",
  off_card2_f1: "تغذية ومكملات غذائية",
  off_card2_f2: "تمارين احترافية",
  off_card2_f3: "متابعة يومية دقيقة",
  off_card3_p1_label: "نظام غذائي وتدريب ومتابعة لمدة 3 شهور",
  off_card3_p1_val: "150,000 د.ع",
  off_card3_p2_label: "نظام تجهيز (لمدة شهرين)",
  off_card3_p2_val: "120,000 د.ع",
  off_card3_note: "ملاحظة: السعر المذكور للتجهيز يشمل فقط المتابعة ولا يتضمن المستلزمات.",
  off_card3_f1: "تجهيز بطولات",
  off_card3_f2: "برمجة يومية",
  off_card3_f3: "أنظمة تجهيز لمراحل متقدمة",
};

/** One line of the services table: what it is, what it costs. */
export interface PlanRow {
  label: string;
  value: string;
  /** The price before a discount, struck through beside the current one. Only
   *  the offers section uses it; empty or absent means nothing is shown. */
  was?: string;
  /** The emphasised figure — the coloured one. This was "whichever row is
   *  first"; it is the coach's choice per row now. */
  highlight?: boolean;
}

export interface PlanCard {
  services: PlanRow[];
  features: string[];
  note: string;
}

/**
 * How many services or features one card may carry.
 *
 * Not a storage limit — the column is free-form JSON and would take any number.
 * It is the card's geometry: these sit in a fixed-height panel three across on
 * a desktop and stacked on a phone, and a seventh row is how that design stops
 * fitting the screen it is read on.
 */
export const MAX_CARD_ROWS = 6;

/** The prefixes the two sections store under: `card1`…`card3`, `off_card1`… */
export function cardPrefix(section: "plan" | "offer", n: number): string {
  return section === "offer" ? `off_card${n}` : `card${n}`;
}

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/* One numbered field, resolved the way the DOM pass resolves it.
 *
 * That pass reads `activeData[key] || defaultContent[key]` and leaves the
 * markup's own text alone when both are empty — so a field stored as "" shows
 * the baseline copy rather than a blank. Two of the offer labels are stored
 * exactly that way and have been rendering their defaults ever since.
 *
 * The lists below have to resolve identically or reading them would erase a
 * line that is on the page today. It applies to the numbered keys only: a label
 * inside a stored list is the coach's own and an empty one there means empty. */
const legacyText = (content: JsonRecord, fallback: JsonRecord | undefined, key: string): string =>
  asText(content[key]) || asText(fallback?.[key]);

/**
 * Whether a field is switched on.
 *
 * The convention is the panel's own — `visibilityKey` there appends `_active` —
 * and absent means shown, so a field nobody has ever touched is untouched.
 */
export function isShown(content: JsonRecord, key: string): boolean {
  return content[`${key}_active`] !== "false";
}

/** A stored list, narrowed. The column is free-form, so a hand-edited or older
 *  row can hold anything, and the card maps over this directly. */
function rowsFrom(value: unknown): PlanRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => {
      const was = asText(entry.was);
      return {
        label: asText(entry.label),
        value: asText(entry.value),
        ...(was ? { was } : {}),
        ...(entry.highlight === true ? { highlight: true } : {}),
      };
    })
    .slice(0, MAX_CARD_ROWS);
}

/* The numbered keys, read as a list.
 *
 * Three is where the old markup stopped, and a row whose label, price and
 * struck-through price are all empty is one the card never drew — the third
 * plan defines only two, so this yields two for it and three for the others,
 * which is what the page shows today.
 *
 * The first row carries the highlight because that is what the markup did:
 * `price-amount highlight` was written on row one of every card and nowhere
 * else. */
function legacyRows(content: JsonRecord, prefix: string, fallback?: JsonRecord): PlanRow[] {
  const rows: PlanRow[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const label = legacyText(content, fallback, `${prefix}_p${i}_label`);
    const value = legacyText(content, fallback, `${prefix}_p${i}_val`);
    const was = legacyText(content, fallback, `${prefix}_p${i}_was`);
    if (!label && !value && !was) continue;
    rows.push({
      label,
      value,
      ...(was ? { was } : {}),
      ...(i === 1 ? { highlight: true } : {}),
    });
  }
  return rows;
}

/* `_active` is honoured here rather than left to the caller: a feature the
   coach switched off in the old panel was hidden by the DOM pass, and reading
   it into the list would put it back. */
function legacyFeatures(content: JsonRecord, prefix: string, fallback?: JsonRecord): string[] {
  const features: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const key = `${prefix}_f${i}`;
    const text = legacyText(content, fallback, key);
    if (!text || !isShown(content, key)) continue;
    features.push(text);
  }
  return features;
}

/**
 * One card's lists, whichever shape they are stored in.
 *
 * `content` is the merged document — defaults under whatever the content
 * manager has saved — so a key the coach has never edited still answers with
 * the copy written in the page.
 */
export function planCardFrom(content: JsonRecord, prefix: string, fallback?: JsonRecord): PlanCard {
  const storedServices = content[`${prefix}_services`];
  const storedFeatures = content[`${prefix}_features`];

  return {
    services: Array.isArray(storedServices)
      ? rowsFrom(storedServices)
      : legacyRows(content, prefix, fallback),
    /* Empty entries are kept, and dropping them was a real bug: the editor adds
       a feature by appending "" for the coach to type into, and a reader that
       filtered blanks deleted it again before the field could be drawn. The
       button looked dead because the list it wrote never came back. Only a
       non-string is refused here — the page is what declines to draw a blank,
       the same way it always skipped an empty numbered key. */
    features: Array.isArray(storedFeatures)
      ? storedFeatures.filter((f): f is string => typeof f === "string").slice(0, MAX_CARD_ROWS)
      : legacyFeatures(content, prefix, fallback),
    note: legacyText(content, fallback, `${prefix}_note`),
  };
}

/* ─── How many plans there are ────────────────────────────────────────────
 *
 * There were three, written out three times in the markup and a third time in
 * the panel. The set is content now: `plan_order` lists the cards on show, in
 * the order they are shown.
 *
 * A card's id is its existing key prefix — `card1`, `card2` — and the value a
 * subscriber is filed under is the matching `plan1`, `plan2`. That pairing is
 * not new and is deliberately left alone: every profile already carries one of
 * those strings, and the whole point of keeping the convention is that none of
 * them has to be rewritten.
 */

/** The three the page has always shown, for a document with no order stored. */
export const DEFAULT_PLAN_ORDER = ["card1", "card2", "card3"];

/** `card4` → 4. Null for anything that is not a plan card id. */
export function planNumberOf(id: string): number | null {
  const m = /^card(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `card4` ⇄ `plan4`. The value a profile stores. */
export function planValueOf(id: string): string {
  const n = planNumberOf(id);
  return n === null ? id : `plan${n}`;
}

/** `plan4` ⇄ `card4`. The prefix its content is stored under. */
export function planIdOf(planValue: string): string {
  const m = /^plan(\d+)$/.exec(planValue);
  return m ? `card${m[1]}` : planValue;
}

/**
 * The plan cards on show, in order.
 *
 * Narrowed rather than trusted — the column is free-form, and this drives both
 * what the page renders and what the form can be pointed at. Anything that is
 * not a plan card id is dropped, and a duplicate would render the same card
 * twice, so the first wins.
 */
export function planOrderFrom(content: JsonRecord): string[] {
  const stored = content.plan_order;
  if (!Array.isArray(stored)) return [...DEFAULT_PLAN_ORDER];

  const seen = new Set<string>();
  const order: string[] = [];
  for (const entry of stored) {
    if (typeof entry !== "string") continue;
    if (planNumberOf(entry) === null) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    order.push(entry);
  }
  return order;
}

/**
 * The id to give a card being added.
 *
 * The lowest number nothing has used — and "used" means more than "is on show".
 * A deleted plan keeps its name so that subscribers filed under it still read
 * correctly, and handing its number to a new plan would quietly refile every
 * one of them under a package they never bought. So anything the document
 * remembers counts, whether it is displayed or not.
 */
export function nextPlanId(content: JsonRecord, order: string[]): string {
  const taken = new Set<number>();
  for (const id of order) {
    const n = planNumberOf(id);
    if (n !== null) taken.add(n);
  }
  for (const key of Object.keys(content)) {
    const m = /^card(\d+)_/.exec(key);
    if (m) taken.add(Number(m[1]));
  }
  let n = 1;
  while (taken.has(n)) n += 1;
  return `card${n}`;
}

/* ─── The colour a plan is painted in ─────────────────────────────────────
 *
 * Three accents were written by hand, and a fourth plan has nobody to write it
 * one. So beyond the third it is derived from the card's number: the same plan
 * always gets the same colour, and no two plans on the page collide.
 *
 * The constraint is that it must not read as something it is not. This palette
 * already spends specific hues on specific meanings, and a plan tinted the
 * colour of an error, or of the brand, is a plan that looks like a warning or
 * looks like a button. So the generator walks the hue circle by the golden
 * angle — which spreads successive values about as far apart as a sequence can
 * — and steps past anything that lands near a hue already spoken for:
 *
 *     0°   --error        #F87171     356°  --plan-1   #820911
 *     43°  --warning      #FBBF24     51°   --plan-2   #FFD700
 *     142° --success      #22C55E     213°  --primary / --info  #60A5FA
 *     262° --plan-3       #370F75
 *
 * Saturation and lightness are fixed rather than derived. These sit on a
 * near-black surface behind white text, and letting them vary is how one plan
 * in five comes out unreadable. */
const RESERVED_HUES = [0, 43, 51, 142, 213, 262, 356];
/* 22° rather than the 18° a hue actually needs to read as its own colour.
   The extra four are for the round trip: the hue is chosen as a number, stored
   as a hex colour, and read back off that hex — and the rounding to eight bits
   per channel moves it by a fraction of a degree. Chosen at exactly 18 it comes
   back at 17.7, which is a clearance that holds in the generator and fails in
   anything measuring the colour that was actually produced. */
const HUE_CLEARANCE = 22;

/* Every hue that is not spoken for, computed once.
 *
 * The first attempt walked the circle by the golden angle and stepped past a
 * reserved hue when it landed on one. Two things were wrong with it, and both
 * were caught by asking the tests to prove the property rather than to check a
 * few values: the clearance test compared the wrong side of the circle, so the
 * sixth and eleventh plans came out gold — the warning colour — and the walk
 * repeats, so the tenth and fifteenth plans were handed the identical hue.
 *
 * Choosing from the allowed set directly cannot do either. */
const ALLOWED_HUES: number[] = (() => {
  const circularGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const hues: number[] = [];
  for (let h = 0; h < 360; h += 1) {
    if (RESERVED_HUES.every((taken) => circularGap(h, taken) >= HUE_CLEARANCE)) hues.push(h);
  }
  return hues;
})();

/* Van der Corput, base 2 — 0.5, 0.25, 0.75, 0.125, 0.625 …
 *
 * Each new value falls in the largest remaining gap, so however many plans
 * there are they are spread as far apart as that many points can be, and no
 * two of the first few hundred land on the same place. A running angle cannot
 * promise either. */
/* Which hue the k-th generated plan gets.
 *
 * Each one goes as far as it can from every hue already in use — the reserved
 * ones are out of the allowed set to begin with, and the plans chosen before it
 * are held at arm's length by this. A fixed sequence was tried first and it is
 * the obvious thing to reach for, but it does not know where the holes in the
 * allowed set are, and it put the fourth and ninth plans 17° apart when there
 * was room for twice that.
 *
 * Stable: the answer for a plan depends on its own number and nothing else, so
 * adding a fifth plan never restyles the fourth. Computed from scratch each
 * time and cached, because it is a walk over 360 integers and there are never
 * many plans.
 */
const hueCache = new Map<number, number>();

function generatedHue(k: number): number {
  const cached = hueCache.get(k);
  if (cached !== undefined) return cached;

  const circularGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const chosen: number[] = [];
  for (let i = 1; i <= k; i += 1) {
    let best = ALLOWED_HUES[0];
    let bestDistance = -1;
    for (const hue of ALLOWED_HUES) {
      /* The first one has nothing to stand apart from, so it is pinned rather
         than left to the tie-break: 180° is as far from the red end of the
         circle as a hue gets, and the three written by hand crowd that end. */
      const distance = chosen.length === 0
        ? -circularGap(hue, 180)
        : Math.min(...chosen.map((taken) => circularGap(hue, taken)));
      if (distance > bestDistance) {
        bestDistance = distance;
        best = hue;
      }
    }
    chosen.push(best);
  }

  const hue = chosen[k - 1];
  hueCache.set(k, hue);
  return hue;
}

/** The accent of a hand-written plan, or null past the third. */
function fixedAccent(n: number): { fill: string; rgb: string; text: string } | null {
  if (n === 1) return { fill: "#820911", rgb: "130, 9, 17", text: "#FFFFFF" };
  if (n === 2) return { fill: "#FFD700", rgb: "255, 215, 0", text: "#000000" };
  if (n === 3) return { fill: "#370F75", rgb: "55, 15, 117", text: "#FFFFFF" };
  return null;
}


/* HSL to RGB, so the generated hue can be written as the `r, g, b` triple the
   card's `rgba(var(--primary-rgb), …)` rules already expect. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255)) as [number, number, number];
}

const hex = (rgb: number[]) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

export interface PlanAccent {
  /** The fill, as a hex colour. */
  fill: string;
  /** The same colour as `r, g, b`, for the card's rgba() rules. */
  rgb: string;
  /** Black or white, whichever is readable on the fill. */
  text: string;
}

/**
 * The accent for plan number `n`, the same every time it is asked.
 *
 * The first three answer with the colours they have always had, so nothing on
 * the page moves. Past that the hue is generated and the result is stable: a
 * plan does not change colour because another was added before it.
 */
export function planAccent(n: number): PlanAccent {
  const fixed = fixedAccent(n);
  if (fixed) return fixed;

  /* Counted from the first generated plan, so the fourth is always the first
     generated hue whatever the three before it happen to be. */
  const hue = generatedHue(n - 3);

  const rgb = hslToRgb(hue, 0.62, 0.42);
  /* Rec. 709 luminance — the same test a designer makes by eye, so a yellow
     accent gets black text and a violet one white. */
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return { fill: hex(rgb), rgb: rgb.join(", "), text: luminance > 0.55 ? "#000000" : "#FFFFFF" };
}

/**
 * The inline tint for a plan tag, or null when the stylesheet already has one.
 *
 * `.crm-tag.plan-1` through `.plan-3` are written out in crm.css and there are
 * only three of them, which was right while there were only three plans. A
 * fourth has no class to match and fell through to the default grey — the same
 * tag every other kind of label wears, so a plan stopped being recognisable at
 * a glance in the one place a coach scans a hundred of them.
 *
 * Null for the first three so the stylesheet keeps its own rules and nothing
 * about the existing tags changes.
 */
export function planTagStyle(planValue: string): { background: string; color: string; borderColor: string } | null {
  const m = /^plan(\d+)$/.exec(planValue);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 3) return null;

  const accent = planAccent(n);
  return { background: accent.fill, color: accent.text, borderColor: accent.fill };
}
