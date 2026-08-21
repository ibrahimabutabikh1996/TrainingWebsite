/* Item 4 — production cookie attributes and Edge/proxy behaviour.
 *
 * Runs against the PRODUCTION build (port 3100, NODE_ENV=production), because
 * the `Secure` flag is set only there — `secure: process.env.NODE_ENV ===
 * "production"` in startSession/endSession. Seeds one throwaway account, logs
 * in, reads the raw Set-Cookie, and removes the account.
 */
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "./_lib.mjs";

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const { q, end } = await db();
const RUN = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const password = `TestOnly_${RUN}`;
const hash = await bcrypt.hash(password, 10);

console.log("=".repeat(78));
console.log(`Item 4 — cookie attributes on the PRODUCTION build (port ${PORT})`);
console.log("=".repeat(78));

const [acc] = await q(
  `insert into public.accounts (username, password, password_changed_at)
   values ($1, $2, now() - interval '1 hour') returning id, username`,
  [`${RUN}_cookie`, hash]
);
/* A profile so the account is a normal trainee; login reads suspension off it. */
const [pro] = await q(
  `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
   values ($1, $2::jsonb, $3, now() + interval '20 days', false) returning id`,
  [`${RUN}_cookie`, JSON.stringify({ __test_run: RUN }), acc.id]
);

try {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: acc.username, password, remember: false }),
    redirect: "manual",
  });
  console.log(`\nlogin status: ${res.status}`);

  /* getSetCookie preserves each Set-Cookie line separately. */
  const cookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);

  for (const c of cookies) {
    const name = c.split("=")[0];
    console.log(`\n  Set-Cookie: ${name}`);
    console.log(`    raw: ${c.replace(/=[^;]*/, "=<value>")}`);
    const flags = {
      HttpOnly: /;\s*HttpOnly/i.test(c),
      Secure: /;\s*Secure/i.test(c),
      SameSite: (c.match(/;\s*SameSite=([^;]+)/i) || [])[1] ?? "(unset)",
      Path: (c.match(/;\s*Path=([^;]+)/i) || [])[1] ?? "(unset)",
      Domain: (c.match(/;\s*Domain=([^;]+)/i) || [])[1] ?? "(host-only)",
      MaxAge: (c.match(/;\s*Max-Age=([^;]+)/i) || [])[1] ?? "(session)",
    };
    for (const [k, v] of Object.entries(flags)) console.log(`    ${k.padEnd(10)}: ${v}`);
  }

  console.log("\n  Interpretation:");
  const sess = cookies.find((c) => c.startsWith("gym_session="));
  const hint = cookies.find((c) => c.startsWith("gym_user="));
  if (sess) {
    console.log(`    gym_session  HttpOnly=${/HttpOnly/i.test(sess)}  Secure=${/Secure/i.test(sess)}  <- the auth cookie`);
    console.log(`                 Secure on the prod build means it will NOT be sent over plain http in production.`);
  }
  if (hint) {
    console.log(`    gym_user     HttpOnly=${/HttpOnly/i.test(hint)}  <- cosmetic hint, script-readable by design`);
  }
} finally {
  console.log("\nCLEANUP");
  await q(`delete from public.profiles where id = $1`, [pro.id]);
  await q(`delete from public.accounts where id = $1`, [acc.id]);
  const [{ n }] = await q(
    `select count(*)::int n from public.accounts where username like $1`,
    [`${RUN}%`]
  );
  console.log(`  rows remaining: ${n}`);
}
console.log("=".repeat(78));
await end();
