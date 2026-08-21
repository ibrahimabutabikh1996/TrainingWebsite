/* Reconcile RLS: for each table, real row count (privileged pg connection) vs
 * rows the shipped anon key can actually read over PostgREST.
 *
 *   real>0 and anon=0   -> RLS is denying. Protected.
 *   real>0 and anon=real-> exposed to anyone holding the public key (every browser).
 *
 * Read-only. Counts only; no values printed, no writes.
 */
import { createClient } from "@supabase/supabase-js";
import { db, readEnv } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(url, readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});
const { q, end } = await db();

const tables = [
  "accounts", "profiles", "workout_logs", "exercises", "courses",
  "client_courses", "diet_plans", "training_cycles", "training_sessions",
  "site_settings", "upload_items", "upload_sessions", "login_attempts",
  "nutrition_sources",
];

console.log("=".repeat(78));
console.log("RLS RECONCILIATION — real rows vs anon-key-visible rows");
console.log("=".repeat(78));
console.log(`  ${"table".padEnd(20)} ${"real".padStart(6)} ${"anon".padStart(6)}   verdict`);

const exposed = [];
for (const t of tables) {
  const [{ n: real }] = await q(`select count(*)::int n from public.${t}`);
  let anonCount = null, err = null;
  const { count, error } = await anon.from(t).select("*", { count: "exact", head: true });
  if (error) err = error.code || error.message.slice(0, 30);
  else anonCount = count ?? 0;

  let verdict;
  if (err) verdict = `DENIED (${err})`;
  else if (anonCount === 0 && real > 0) verdict = "protected (RLS denies)";
  else if (anonCount === 0 && real === 0) verdict = "empty (indeterminate)";
  else { verdict = `EXPOSED — anon reads ${anonCount}`; exposed.push(t); }

  console.log(`  ${t.padEnd(20)} ${String(real).padStart(6)} ${String(anonCount ?? "-").padStart(6)}   ${verdict}`);
}

console.log("=".repeat(78));
console.log(exposed.length
  ? `EXPOSED via the public anon key: ${exposed.join(", ")}`
  : "No table is readable by the anon key.");
console.log("=".repeat(78));
await end();
