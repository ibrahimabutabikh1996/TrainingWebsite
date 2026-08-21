/* Shared plumbing for the P0 HTTP verification run.
 *
 * These tests talk to a real database and a real local server, because the unit
 * tests cannot prove what an endpoint does — only what a function returns. What
 * they must never do is touch a row this run did not create, so every insert is
 * recorded in a manifest and the cleanup deletes by id from that manifest and
 * from nothing else.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const MANIFEST_PATH = path.join(import.meta.dirname, ".run-manifest.json");
export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
export const readEnv = (k) =>
  (env.match(new RegExp(`^${k}="?([^"\\n\\r]+)"?`, "m")) || [])[1];

export const DIRECT_URL = readEnv("DIRECT_URL");
export const SESSION_SECRET = readEnv("SESSION_SECRET");

/* ---------------------------------------------------------------- db -- */

export async function db() {
  const client = new pg.Client({ connectionString: DIRECT_URL });
  await client.connect();
  return {
    client,
    q: async (sql, p = []) => (await client.query(sql, p)).rows,
    end: () => client.end(),
  };
}

/* ---------------------------------------------------------- manifest -- */

export function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("No run manifest. Run seed.mjs first.");
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

export function saveManifest(m) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

/* ----------------------------------------------------------- session -- */

/* Mints the same token `@/lib/session` verifies: v2.<payload>.<hmac>. Used to
   act as a seeded test account without going through a password. */
export function mintSession({ id, username }, { ttl = 3600, issuedAt } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const i = issuedAt ?? now;
  const payload = { s: id, u: username, e: now + ttl, i };
  const body = `v2.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export const cookieFor = (token) => `gym_session=${token}`;

/* -------------------------------------------------------------- http -- */

/* Every request gets its own synthetic client address.
 *
 * Without it the harness throttles itself: /api/submit-form allows five per
 * fifteen minutes per address, and a suite that exercises that endpoint a dozen
 * times spends the window on itself and then reads 429 as if it were the
 * endpoint's answer. Nine tests failed that way on the first run.
 *
 * Isolating by address rather than by clearing `public.login_attempts` is
 * deliberate: that table also holds counters this run did not create, and this
 * run does not touch rows it did not create.
 *
 * Note what makes this possible — `clientAddress()` trusts the leftmost
 * `x-forwarded-for` value, so a caller can pick its own identity. That is
 * VULN-04, which is deliberately still unfixed. The harness is standing on a
 * known-open door, and the fact that it works is itself a demonstration of it.
 */
let ipCounter = 0;
const nextTestIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;

export async function http(method, endpoint, { body, cookie, headers = {}, ip } = {}) {
  const res = await fetch(BASE_URL + endpoint, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Forwarded-For": ip ?? nextTestIp(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML or empty — fine, the status is what most tests assert on */
  }
  return { status: res.status, json, text: text.slice(0, 300) };
}

/* ------------------------------------------------------------ report -- */

export const results = [];

export function record(row) {
  results.push(row);
  const mark = row.pass === true ? "PASS" : row.pass === false ? "FAIL" : "INFO";
  console.log(`  [${mark}] ${row.test} — HTTP ${row.http ?? "-"} — ${row.note ?? ""}`);
}

/* A profile's renewal-relevant state, for the Before/After tables. */
export async function snapshot(q, profileId) {
  const rows = await q(
    `select id, subscription_ends_at, is_suspended, data from public.profiles where id = $1`,
    [profileId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const d = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
  return {
    subscription_ends_at: r.subscription_ends_at ? r.subscription_ends_at.toISOString() : null,
    is_suspended: r.is_suspended,
    renewal_pending: d.renewal_pending ?? null,
    renewal_requested_at: d.renewal_requested_at ?? null,
    renewal_requested_month: d.renewal_requested_month ?? null,
    renewals_count: Array.isArray(d.renewals) ? d.renewals.length : 0,
    history_count: Array.isArray(d.history) ? d.history.length : 0,
  };
}

export const DAY = 86400000;
export const daysBetween = (a, b) =>
  a && b ? Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY) : null;

export function fmt(s) {
  if (!s) return "(none)";
  return typeof s === "object" ? JSON.stringify(s) : String(s);
}
