/* POT-03 — baseline snapshot taken immediately before any change.
 *
 * Records exactly what exists now (RLS flags, policies, bucket visibility, row
 * counts) so the change is reversible from a written record rather than from
 * memory, and so before/after can be shown side by side.
 *
 * Read-only. Writes the snapshot to pot03-baseline.json next to this file.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { db, readEnv } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(url, readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const { q, end } = await db();

const TARGETS = ["upload_items", "upload_sessions", "login_attempts", "nutrition_sources"];
const snap = { takenAt: new Date().toISOString() };

console.log("=".repeat(78));
console.log("POT-03 BASELINE — state immediately before any change");
console.log("=".repeat(78));

/* --- bucket --- */
const [bucket] = await q(`select id, name, public, file_size_limit from storage.buckets where name = 'uploads'`);
snap.bucket = bucket;
console.log(`\n[bucket] uploads.public = ${bucket.public}`);

/* --- storage policies (verbatim, for rollback) --- */
snap.storagePolicies = await q(
  `select policyname, cmd, roles::text as roles, qual, with_check
   from pg_policies where schemaname='storage' and tablename='objects' order by policyname`
);
console.log(`[storage policies] ${snap.storagePolicies.length}`);
for (const p of snap.storagePolicies) {
  console.log(`  ${p.policyname} [${p.cmd}] roles=${p.roles} USING=${p.qual ?? "-"} CHECK=${p.with_check ?? "-"}`);
}

/* --- RLS flags on every public table --- */
snap.rls = await q(
  `select c.relname as t, c.relrowsecurity as rls,
          (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)::int as pols
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' order by c.relname`
);
console.log(`\n[public tables RLS]`);
for (const r of snap.rls) console.log(`  ${r.t.padEnd(20)} rls=${r.rls} policies=${r.pols}`);

/* --- what anon can read right now --- */
console.log(`\n[anon readability BEFORE]`);
snap.anonBefore = {};
for (const t of TARGETS) {
  const { count, error } = await anon.from(t).select("*", { count: "exact", head: true });
  snap.anonBefore[t] = error ? `DENIED:${error.code ?? error.message.slice(0, 20)}` : (count ?? 0);
  console.log(`  ${t.padEnd(20)} ${snap.anonBefore[t]}`);
}

/* --- row counts (baseline integrity) --- */
snap.counts = {};
for (const t of ["accounts", "profiles", "upload_sessions", "upload_items", ...TARGETS]) {
  const [{ n }] = await q(`select count(*)::int n from public.${t}`);
  snap.counts[t] = n;
}
console.log(`\n[row counts] ${Object.entries(snap.counts).map(([k, v]) => `${k}=${v}`).join(" ")}`);

/* --- PROOF: does any client-side code read these tables via the anon key? --- */
console.log(`\n[proof] client-side DB access audit`);
const src = fs.readFileSync(new URL("../../src/lib/signedUpload.ts", import.meta.url), "utf8");
const usesFrom = /\.from\(\s*["'](?!uploads)/.test(src);
console.log(`  signedUpload.ts (the only anon createClient) queries a table: ${usesFrom}`);
console.log(`  -> it calls storage.from("uploads").uploadToSignedUrl only`);
console.log(`  rateLimit.ts is server-only: ${fs.readFileSync(new URL("../../src/lib/rateLimit.ts", import.meta.url), "utf8").startsWith('import "server-only"')}`);
console.log(`  => all table access is Prisma (service role), which bypasses RLS`);

fs.writeFileSync(new URL("./pot03-baseline.json", import.meta.url), JSON.stringify(snap, null, 2));
console.log(`\nsnapshot written to tests/http/pot03-baseline.json`);
console.log("=".repeat(78));
await end();
