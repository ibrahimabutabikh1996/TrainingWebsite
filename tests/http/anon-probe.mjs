/* Can the public anon key actually read trainee data or the uploads bucket?
 *
 * The config audit showed a contradiction worth resolving with a live request,
 * not by reasoning about the flags: `public` tables have RLS ON with NO policies
 * (which denies), yet the anon role also holds direct SELECT grants (which would
 * allow if RLS did not apply). RLS wins over grants — but that is a claim to
 * TEST, using the same anon key the browser is shipped, against the same PostgREST
 * endpoint the browser can reach. Three of the app's own tables have RLS OFF.
 *
 * Read-only. Selects at most one row and prints only whether a row came back and
 * which columns exist — never a value. No write is attempted.
 */
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./_lib.mjs";

const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

console.log("=".repeat(74));
console.log("ANON KEY REACHABILITY — as a browser would, over PostgREST + Storage");
console.log(`project: ${new URL(url).hostname}`);
console.log("=".repeat(74));

const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function probeTable(table) {
  const { data, error, count } = await anon
    .from(table)
    .select("*", { count: "exact", head: false })
    .limit(1);
  if (error) {
    console.log(`  ${table.padEnd(18)} DENIED   (${error.code ?? ""} ${error.message.slice(0, 60)})`);
    return { table, readable: false };
  }
  const cols = data && data[0] ? Object.keys(data[0]) : [];
  console.log(
    `  ${table.padEnd(18)} READABLE rows≈${count ?? "?"}  columns: ${cols.join(",").slice(0, 90) || "(empty table)"}`
  );
  return { table, readable: true, count, cols };
}

console.log("\n[A] APPLICATION TABLES via the anon key");
const tables = [
  "accounts", "profiles", "upload_items", "upload_sessions",
  "login_attempts", "nutrition_sources", "exercises", "workout_logs",
];
const results = [];
for (const t of tables) results.push(await probeTable(t));

console.log("\n[B] STORAGE: list the uploads bucket via the anon key");
try {
  const { data, error } = await anon.storage.from("uploads").list("usersData", { limit: 3 });
  if (error) {
    console.log(`  list usersData/ : DENIED (${error.message.slice(0, 70)})`);
  } else {
    console.log(`  list usersData/ : ALLOWED — ${data.length} entries visible to anon`);
    for (const e of data) console.log(`      ${e.name}`);
  }
} catch (e) {
  console.log(`  list error: ${e.message}`);
}

console.log("\n[C] STORAGE: fetch a real object's PUBLIC url (no auth at all)");
/* Reads one path from the DB only to construct the public URL; the fetch itself
   carries no key, exactly as an anonymous internet client would. */
import { db } from "./_lib.mjs";
const { q, end } = await db();
try {
  const [row] = await q(
    `select storage_path from public.upload_items where storage_path like 'usersData/%' limit 1`
  );
  if (!row) {
    console.log("  (no usersData object to test)");
  } else {
    const publicUrl = `${url}/storage/v1/object/public/uploads/${row.storage_path}`;
    const res = await fetch(publicUrl);
    console.log(`  GET (public url, no key) -> HTTP ${res.status} ${res.statusText}`);
    console.log(
      res.status === 200
        ? "      <-- a trainee's uploaded file is readable by anyone with the URL"
        : "      <-- not served without authorisation"
    );
    console.log(`      (path shape was guessable? needs the 122-bit UUID segment: usersData/<UUIDv4>/...)`);
  }
} finally {
  await end();
}

console.log("\n" + "=".repeat(74));
console.log("Summary:");
const readable = results.filter((r) => r.readable).map((r) => r.table);
console.log("  anon-READABLE tables:", readable.length ? readable.join(", ") : "(none)");
console.log("=".repeat(74));
