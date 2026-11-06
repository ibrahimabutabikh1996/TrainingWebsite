/* Challenges — the shapes and small rules both ends share.
 *
 * The coach sets a challenge in /admin/challenges. A trainee films themselves
 * doing it and presses "أتممت التحدي" on their dashboard, which opens WhatsApp to
 * the coach with a prefilled message carrying a reference, and records a
 * pending submission. The coach watches the video in WhatsApp and approves the
 * submission in the panel — approving is what awards the points.
 *
 * Client-safe: no Prisma here. The tables are in
 * prisma/manual/2026-11-04-challenges.sql. */

export type SubmissionStatus = "pending" | "approved" | "rejected";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "بانتظار المراجعة",
  approved: "تم",
  rejected: "مرفوض",
};

export function isSubmissionStatus(value: unknown): value is SubmissionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

/** A challenge as the panel edits it. Dates are ISO strings or null. */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: string;
  points: number;
  video_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** The trainee's own submission for one challenge, as their dashboard shows it. */
export interface MySubmission {
  status: SubmissionStatus;
  reference: string;
  points_awarded: number;
  reject_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

/** One card on the trainee's challenges tab. */
export interface TraineeChallenge {
  id: string;
  title: string;
  description: string;
  target: string;
  points: number;
  video_url: string | null;
  ends_at: string | null;
  /** Still open for submitting — active and inside its dates. */
  is_open: boolean;
  submission: MySubmission | null;
}

/** What GET /api/challenges answers a trainee with. */
export interface TraineeChallengesResponse {
  challenges: TraineeChallenge[];
  totalPoints: number;
  /** The coach's WhatsApp number, digits only. */
  whatsapp: string;
  fullname: string;
  /** The tables are not there yet — prisma/manual/2026-11-04-challenges.sql. */
  unavailable?: boolean;
}

/** One row in the panel's review queue and history. */
export interface SubmissionRow {
  id: string;
  challenge_id: string;
  challenge_title: string;
  challenge_target: string;
  challenge_points: number;
  profile_id: string;
  trainee_name: string;
  /** Digits only, ready for wa.me — empty when the intake has no phone. */
  trainee_phone: string;
  reference: string;
  status: SubmissionStatus;
  points_awarded: number;
  reject_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
}

/** One line of the points table in the panel. */
export interface LeaderboardRow {
  profile_id: string;
  trainee_name: string;
  points: number;
  completed: number;
}

/* ------------------------------------------------------------------ *
 * References
 * ------------------------------------------------------------------ */

/* No 0/O, 1/I/L — the coach reads this off a phone screen. Same alphabet as the
   store's order references. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function makeChallengeReference(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "CH-";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function isChallengeReference(value: unknown): value is string {
  return typeof value === "string" && /^CH-[2-9A-HJKMNP-Z]{6}$/.test(value);
}

/* ------------------------------------------------------------------ *
 * WhatsApp
 * ------------------------------------------------------------------ */

/** A wa.me link — to the coach with a message, or to a trainee with none. */
export function whatsAppLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

/**
 * A trainee's phone as wa.me wants it: international digits. The intake form
 * takes Iraqi numbers as people type them (07…), which wa.me does not dial.
 */
export function traineeWhatsAppDigits(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "").replace(/^00/, "");
  if (/^07\d{9}$/.test(digits)) return `964${digits.slice(1)}`;
  return digits.length >= 8 ? digits : "";
}

/** The message the trainee sends with their video. */
export function buildChallengeMessage(input: {
  title: string;
  target: string;
  fullname: string;
  reference: string;
}): string {
  return [
    "السلام عليكم كابتن إبراهيم 👋",
    `أتممت التحدي: ${input.title}`,
    input.target ? `الهدف: ${input.target}` : null,
    `الاسم: ${input.fullname}`,
    `رمز الطلب: ${input.reference}`,
    "",
    "📹 مرفق فيديو التحدي",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

/** Whether a challenge takes submissions at `now`. */
export function challengeIsOpen(
  c: { is_active: boolean; starts_at: string | Date | null; ends_at: string | Date | null },
  now: Date = new Date()
): boolean {
  if (!c.is_active) return false;
  const t = now.getTime();
  if (c.starts_at && new Date(c.starts_at).getTime() > t) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() < t) return false;
  return true;
}
