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
    features: Array.isArray(storedFeatures)
      ? storedFeatures.filter((f): f is string => typeof f === "string" && f.trim() !== "").slice(0, MAX_CARD_ROWS)
      : legacyFeatures(content, prefix, fallback),
    note: legacyText(content, fallback, `${prefix}_note`),
  };
}
