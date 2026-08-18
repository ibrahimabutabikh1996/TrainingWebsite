import bcrypt from "bcrypt";

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

/** The reason it is unacceptable, in Arabic, or null when it is fine. */
export function credentialError(username: unknown, password: unknown): string | null {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    return "اسم المستخدم يجب أن يكون بين 3 و32 خانة من حروف إنجليزية أو أرقام أو . _ -";
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
