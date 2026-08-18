/*
 * Resets an account password directly, for when the current one is unknown and
 * the /account/password screen therefore cannot be used — there is no
 * self-service reset in the app, so this is the only way back into an account.
 *
 * Run it with Node's own env loader so DIRECT_URL is read from .env:
 *   node --env-file=.env scripts/reset-password.mjs <username> <new-password>
 *
 * Passing the password as an argument leaves it in your shell history; clear it
 * afterwards, or change the password again from the app once you are signed in.
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

/* Kept in step with src/app/api/auth/change-password/route.ts and the client
   check in src/app/account/password/page.tsx. */
const MIN_LENGTH = 8;
/* Matches hashPassword() in src/lib/auth.ts. That module is TypeScript, so it
   cannot be imported here without a build step; the cost is this one constant. */
const SALT_ROUNDS = 10;

const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error("Usage: node --env-file=.env scripts/reset-password.mjs <username> <new-password>");
  process.exit(1);
}

if (newPassword.length < MIN_LENGTH) {
  console.error(`Password must be at least ${MIN_LENGTH} characters (got ${newPassword.length}).`);
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL is not set. Did you pass --env-file=.env ?");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const account = await prisma.accounts.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!account) {
    /* Listing the real usernames turns a typo into a one-line fix rather than a
       guessing game. */
    const all = await prisma.accounts.findMany({ select: { username: true } });
    console.error(`No account named "${username}".`);
    console.error(`Existing accounts: ${all.map((a) => a.username).join(", ") || "(none)"}`);
    process.exit(1);
  }

  /* `password_changed_at` alongside the password, matching both change-password
     routes: any session opened with the old password is refused from its next
     request. This script is the last-resort path back into an account, which
     means it is also the one most likely to be run because someone else got in —
     so leaving their session alive would defeat the reset. */
  await prisma.accounts.update({
    where: { id: account.id },
    data: {
      password: await bcrypt.hash(newPassword, SALT_ROUNDS),
      password_changed_at: new Date(),
    },
  });

  /* Never print the password itself. */
  console.log(`Password reset for "${account.username}" (${account.id}).`);
  console.log("Any sessions opened with the old password are now signed out.");
  console.log("Sign in with the new password, then change it from /account/password.");
} finally {
  await prisma.$disconnect();
  await pool.end();
}
