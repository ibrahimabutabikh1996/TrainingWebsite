/* POT-03 + RLS — what the Supabase project itself is configured to allow.
 *
 * Read-only. Queries configuration tables (bucket flags, policies, grants), not
 * anybody's data: the question is whether the platform would refuse an
 * unauthorised reader on its own, independently of the application's guards.
 */
import { db } from "./_lib.mjs";

const { q, end } = await db();
const line = (s) => console.log(s);

line("=".repeat(74));
line("POT-03 / RLS — Supabase configuration audit (read-only)");
line("=".repeat(74));

/* ---------------------------------------------------------- buckets -- */
line("\n[1] STORAGE BUCKETS");
try {
  const buckets = await q(
    `select id, name, public, file_size_limit, allowed_mime_types, created_at
     from storage.buckets order by name`
  );
  if (buckets.length === 0) line("  (no buckets visible to this role)");
  for (const b of buckets) {
    line(`  bucket "${b.name}"`);
    line(`    public            : ${b.public}   ${b.public ? "<-- anyone with the URL can read" : "<-- signed URLs required"}`);
    line(`    file_size_limit   : ${b.file_size_limit ?? "(none set at bucket level)"}`);
    line(`    allowed_mime_types: ${b.allowed_mime_types ?? "(none set at bucket level)"}`);
  }
} catch (e) {
  line(`  could not read storage.buckets: ${e.message}`);
}

/* --------------------------------------------------- storage policies -- */
line("\n[2] RLS POLICIES ON storage.objects");
try {
  const pol = await q(
    `select policyname, cmd, roles::text as roles, qual, with_check
     from pg_policies where schemaname = 'storage' and tablename = 'objects'
     order by policyname`
  );
  if (pol.length === 0) line("  (none — storage.objects has no policies)");
  for (const p of pol) {
    line(`  ${p.policyname}  [${p.cmd}]  roles=${p.roles}`);
    if (p.qual) line(`      USING: ${String(p.qual).slice(0, 160)}`);
    if (p.with_check) line(`      CHECK: ${String(p.with_check).slice(0, 160)}`);
  }
  const rls = await q(
    `select relrowsecurity, relforcerowsecurity from pg_class
     where oid = 'storage.objects'::regclass`
  );
  line(`  RLS enabled on storage.objects: ${rls[0]?.relrowsecurity}`);
} catch (e) {
  line(`  could not read storage policies: ${e.message}`);
}

/* ------------------------------------------------- public table RLS -- */
line("\n[3] RLS ON THE APPLICATION'S OWN TABLES (schema public)");
try {
  const t = await q(
    `select c.relname as table,
            c.relrowsecurity as rls_enabled,
            (select count(*) from pg_policies p
              where p.schemaname='public' and p.tablename=c.relname)::int as policies
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relkind='r'
     order by c.relname`
  );
  for (const r of t) {
    const flag = r.rls_enabled
      ? (r.policies > 0 ? "RLS on, policies present" : "RLS on, NO policies -> denies anon by default")
      : "RLS OFF  <-- relies entirely on the app + key secrecy";
    line(`  ${r.table.padEnd(20)} ${flag}`);
  }
} catch (e) {
  line(`  could not read table RLS: ${e.message}`);
}

/* --------------------------------------------- what anon role may do -- */
line("\n[4] GRANTS TO THE `anon` ROLE ON public TABLES");
line("    (the anon key is shipped to every browser, so this is what a visitor holds)");
try {
  const g = await q(
    `select table_name, string_agg(distinct privilege_type, ',' order by privilege_type) as privs
     from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
     group by table_name order by table_name`
  );
  if (g.length === 0) line("  (anon has no table grants in public)");
  for (const r of g) line(`  ${r.table_name.padEnd(20)} ${r.privs}`);
} catch (e) {
  line(`  could not read grants: ${e.message}`);
}

/* ------------------------------------------------ storage path shape -- */
line("\n[5] STORAGE PATH GUESSABILITY (structure only — no file contents read)");
try {
  const shape = await q(
    `select count(*)::int as n,
            count(distinct split_part(storage_path,'/',1))::int as prefixes
     from public.upload_items`
  );
  line(`  upload_items rows: ${shape[0].n}, distinct top-level prefixes: ${shape[0].prefixes}`);
  const sample = await q(
    `select regexp_replace(storage_path, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<UUIDv4>', 'g') as shape
     from public.upload_items limit 3`
  );
  line("  path shape (identifiers masked):");
  for (const s of sample) line(`    ${s.shape.replace(/_[a-z0-9]{8,}$/i, "_<RANDOM>")}`);
} catch (e) {
  line(`  could not inspect paths: ${e.message}`);
}

line("\n" + "=".repeat(74));
await end();
