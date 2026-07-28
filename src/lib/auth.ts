import bcrypt from "bcrypt";

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
