/* PHASE 1 — safety gate.
 *
 * Reports what we are about to connect to, reading the indicators out of the
 * live database rather than inferring them from a name, and refuses to continue
 * if the Test Run ID is not unique. No secret is printed.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { db, readEnv, MANIFEST_PATH } from "./_lib.mjs";

function describe(label, raw) {
  if (!raw) return console.log(`${label}: (not set)`);
  const u = new URL(raw);
  const port = u.port || "5432";
  console.log(`\n${label}`);
  console.log(`  hostname   : ${u.hostname}`);
  console.log(`  port       : ${port}`);
  console.log(`  database   : ${u.pathname.slice(1).split("?")[0]}`);
  console.log(`  user       : ${u.username.split(".")[0]}.<project-ref redacted>`);
  console.log(`  password   : <redacted — ${decodeURIComponent(u.password).length} chars>`);
  console.log(
    `  conn type  : ${port === "6543" ? "TRANSACTION pooler" : port === "5432" ? "SESSION pooler / direct" : "unknown"}`
  );
  console.log(
    `  host kind  : ${u.hostname.includes("pooler.supabase.com") ? "Supabase POOLER" : u.hostname.includes("supabase.co") ? "Supabase DIRECT" : "non-Supabase"}`
  );
}

console.log("=".repeat(70));
console.log("PHASE 1 — SAFETY GATE");
console.log("=".repeat(70));

describe("DATABASE_URL  (app runtime)", readEnv("DATABASE_URL"));
describe("DIRECT_URL    (this harness)", readEnv("DIRECT_URL"));

const { q, end } = await db();

console.log("\nENVIRONMENT INDICATORS — read from the live database, not guessed");
const [info] = await q(
  "select current_database() as db, current_user as usr, version() as ver, inet_server_addr()::text as addr"
);
console.log(`  current_database  : ${info.db}`);
console.log(`  current_user      : ${info.usr}`);
console.log(`  server version    : ${info.ver.split(" ").slice(0, 2).join(" ")}`);
console.log(`  server address    : ${info.addr ?? "(not exposed by pooler)"}`);

console.log("\n  PRE-EXISTING ROWS — out of scope, never read into tests, never modified:");
const counts = await q(`
  select 'accounts' as t, count(*)::int as n from public.accounts
  union all select 'profiles', count(*)::int from public.profiles
  union all select 'upload_sessions', count(*)::int from public.upload_sessions
  union all select 'upload_items', count(*)::int from public.upload_items
  order by t`);
for (const r of counts) console.log(`    ${r.t.padEnd(16)} ${String(r.n).padStart(5)}`);

const RUN_ID = `SECURITY_TEST_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
console.log(`\nTEST RUN ID : ${RUN_ID}`);

const [{ n: collide }] = await q(
  `select (
     (select count(*) from public.accounts where username like $1) +
     (select count(*) from public.profiles where username like $1)
   )::int as n`,
  [`%${RUN_ID}%`]
);
console.log(`Rows already carrying this Run ID : ${collide}`);
if (collide !== 0) {
  console.error("\nGATE FAILED — Run ID collision. Aborting before any write.");
  await end();
  process.exit(1);
}

const [{ n: stale }] = await q(
  `select count(*)::int as n from public.accounts where username like 'SECURITY\\_TEST\\_%'`
);
console.log(`Leftover SECURITY_TEST_* accounts from earlier runs : ${stale}`);

fs.writeFileSync(
  MANIFEST_PATH,
  JSON.stringify({ runId: RUN_ID, createdAt: new Date().toISOString(), accounts: [], profiles: [], uploadSessions: [], uploadItems: [] }, null, 2)
);

console.log(`\nGATE PASSED — Run ID is unique. Manifest initialised.`);
await end();
