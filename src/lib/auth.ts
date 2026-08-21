import bcrypt from "bcrypt";
import { ADMIN_USERNAMES } from "@/lib/adminUsernames";

/* What a username and a password may be.
 *
 * One definition, because there are two ways an account is created — a stranger
 * filling in the intake form, and the coach making one from the panel — and they
 * disagreed. The registration path checked a shape and a length; the panel
 * checked that the password had eight characters and nothing else, so a username
 * with spaces, or five hundred characters of Arabic, was accepted there and then
 * had to be typed at a sign-in screen by the person it belonged to.
 */

/** Letters, digits, dot, underscore, hyphen. Something a person can be told over the phone. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt itself stops at 72 bytes; this is only here so a huge string is never hashed. */
export const MAX_PASSWORD_LENGTH = 128;

/* Names nobody may register for themselves.
 *
 * `isAdminUsername` decides what a session is allowed to do, and it decides it
 * from a string — so the names on that list are credentials in everything but
 * name. Nothing refused them at account creation: the intake form is open to
 * the public and lets the visitor choose their own username, and the only thing
 * standing between a stranger and the coach's panel was whether the row already
 * existed. That is not a check, it is a coincidence.
 *
 * Compared case-insensitively even though `isAdminUsername` matches exactly.
 * Registering `Admin` grants nothing today, and the point is that it must not
 * start granting something the day that comparison is relaxed — nor should a
 * near-miss of the coach's name be available to impersonate them with.
 */
const EXTRA_RESERVED = ["administrator", "root", "system", "support", "coach"] as const;

export function isReservedUsername(username: unknown): boolean {
  if (typeof username !== "string") return false;
  const normalised = username.trim().toLowerCase();
  if (!normalised) return false;

  return (
    ADMIN_USERNAMES.some((name) => name.toLowerCase() === normalised) ||
    (EXTRA_RESERVED as readonly string[]).includes(normalised)
  );
}

/**
 * Whether a stored password is a bcrypt hash rather than one of the legacy
 * plaintext rows.
 *
 * One definition, because there were three and they disagreed. `/api/auth/login`
 * tested `/^\$2[aby]\$/`; `/api/auth/change-password` and the delete
 * confirmation in the admin panel both tested `$2a$` and `$2b$` only — so a
 * `$2y$` row (what PHP's crypt writes, and what several import tools emit) fell
 * through to being compared as plaintext on two of the three paths. That turns
 * the stored hash itself into an accepted password, which is precisely the
 * thing the plaintext branch was fenced off to prevent.
 */
export function isBcryptHash(stored: unknown): boolean {
  return typeof stored === "string" && /^\$2[aby]\$/.test(stored);
}

/** The reason it is unacceptable, in Arabic, or null when it is fine. */
export function credentialError(username: unknown, password: unknown): string | null {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    return "اسم المستخدم يجب أن يكون بين 3 و32 خانة من حروف إنجليزية أو أرقام أو . _ -";
  }
  if (isReservedUsername(username)) {
    return "اسم المستخدم محجوز، يرجى اختيار اسم آخر";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} خانات على الأقل`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `كلمة المرور يجب ألا تتجاوز ${MAX_PASSWORD_LENGTH} خانة`;
  }
  return null;
}

/**
 * Hashes a plaintext password using bcrypt.
 * @param password The plaintext password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compares a plaintext password with a hashed password.
 * @param password The plaintext password
 * @param hash The hashed password stored in the database
 * @returns boolean indicating if they match
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
