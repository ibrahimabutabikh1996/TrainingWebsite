/* Comparing Arabic text the way people type it.
 *
 * Every search box in the panel matched with `haystack.toLowerCase().includes(
 * needle.toLowerCase())`, which asks for the same characters in the same order.
 * That is a fair rule for Latin text and a poor one for Arabic, where one word
 * has several spellings that are all correct and all common:
 *
 *   ا أ إ آ    the alif, with or without its hamza
 *   ة ه        taa marbuta, routinely typed as a plain haa
 *   ى ي        alif maqsura and yaa, interchangeable in most keyboards
 *   ؤ ئ        hamza on a carrier
 *   َ ُ ِ ّ ْ ً ٌ ٍ  the harakat, which nobody types into a search box
 *   ـ          tatweel, which sits inside a word purely to stretch it
 *   ٠١٢٣       Arabic-Indic digits, shown all over this app
 *
 * So a coach searching "اضخم" found nothing while the course was stored as
 * "أضخم" — measured, not supposed. The two are the same word.
 *
 * The project's earlier answer to this was `scripts/strip_hamzas.ts`, which
 * rewrote the stored rows. That treats the data rather than the comparison: it
 * changes what the coach typed, it reached only `exercises` and
 * `nutrition_sources`, and a row inserted afterwards is unfixed again. Folding
 * at comparison time leaves every stored name exactly as written and covers
 * every table at once.
 *
 * Deliberately conservative. Each rule folds spellings of the *same* word;
 * none merges different ones. Widening it further — dropping every hamza, say —
 * would start matching words nobody asked for, which is the failure that looks
 * like success: a search that answers everything is as useless as one that
 * answers nothing.
 */

/** Harakat and the superscript alif — U+064B…U+0652 and U+0670. */
const DIACRITICS = /[ً-ْٰ]/g;
/** Tatweel: a stretch character with no meaning of its own. */
const TATWEEL = /ـ/g;

const LETTER_FOLDS: [RegExp, string][] = [
  [/[آأإٱٲٳ]/g, "ا"], // آ أ إ ٱ ٲ ٳ → ا
  [/ى/g, "ي"], // ى → ي
  [/ة/g, "ه"], // ة → ه
  [/ؤ/g, "و"], // ؤ → و
  [/ئ/g, "ي"], // ئ → ي
];

/** Arabic-Indic (٠–٩) and Eastern Arabic-Indic (۰–۹) digits, to ASCII. */
function foldDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * The comparable form of a string: folded, undecorated, lower-case, and with
 * runs of whitespace collapsed.
 *
 * Applied to both sides of every comparison. Never stored — the value in the
 * database stays exactly as it was written.
 */
export function normalizeArabic(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  text = text.replace(DIACRITICS, "").replace(TATWEEL, "");
  for (const [pattern, replacement] of LETTER_FOLDS) {
    text = text.replace(pattern, replacement);
  }
  text = foldDigits(text);

  /* `toLowerCase` still matters: names, plan keys and usernames in this app are
     as often Latin as Arabic, and it is a no-op on Arabic letters. */
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Whether `haystack` contains `needle`, both read the forgiving way.
 *
 * An empty needle matches everything, which is what an empty search box means.
 */
export function arabicIncludes(haystack: unknown, needle: string): boolean {
  if (!needle) return true;
  return normalizeArabic(haystack).includes(needle);
}
