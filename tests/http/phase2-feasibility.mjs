/* Phase 2 feasibility — tested, not assumed.
 *
 * Making the bucket private is only safe if the CMS imagery has a working route
 * that does not depend on public reads. Two unknowns decide it:
 *
 *   A. does /api/attachments serve an `images/` object to an anonymous caller?
 *   B. does Next's image optimiser (/_next/image), which every landing-page
 *      image goes through via optimizedSrc(), cope with a URL that answers 307
 *      to a signed URL?
 *
 * If B fails, the landing page loses its imagery and that is a blocker for the
 * CMS half — to be reported, not worked around.
 */
import { db } from "./_lib.mjs";

const BASE = "http://localhost:3000";
const { q, end } = await db();

console.log("=".repeat(78));
console.log("PHASE 2 FEASIBILITY — CMS imagery without public reads");
console.log("=".repeat(78));

/* A real CMS image path, taken from site_settings. */
const [ss] = await q(`select content_ar from public.site_settings where id='landing_content'`);
const c = typeof ss.content_ar === "string" ? JSON.parse(ss.content_ar) : ss.content_ar;
const marker = "/storage/v1/object/public/uploads/";
let cmsPath = null, cmsUrl = null;
for (const [k, v] of Object.entries(c)) {
  if (typeof v === "string" && v.includes(marker)) {
    cmsUrl = v;
    cmsPath = decodeURIComponent(v.split(marker)[1]);
    console.log(`\nusing CMS key "${k}" -> path ${cmsPath.slice(0, 60)}`);
    break;
  }
}
if (!cmsPath) { console.log("no CMS storage image found"); await end(); process.exit(0); }

const results = [];
const check = (n, exp, act, ok) => { results.push({ n, ok }); console.log(`  [${ok ? "PASS" : "FAIL"}] ${n}\n         expected: ${exp}\n         actual  : ${act}`); };

/* ---- A: reader serves images/ anonymously ---- */
console.log("\n[A] /api/attachments with an images/ path, no session");
{
  const r = await fetch(`${BASE}/api/attachments?path=${encodeURIComponent(cmsPath)}`, { redirect: "manual" });
  const loc = r.headers.get("location") || "";
  check(
    "anonymous reader serves a CMS image",
    "307 redirect to a signed URL",
    `HTTP ${r.status}${loc ? ` -> ${loc.slice(0, 55)}...` : ""}`,
    r.status === 307 && loc.includes("token=")
  );

  /* and the signed URL it points at must actually deliver bytes */
  if (r.status === 307 && loc) {
    const f = await fetch(loc);
    check("the signed URL delivers the image", "200 + image bytes", `HTTP ${f.status} ${f.headers.get("content-type")}`, f.status === 200);
  }
}

/* ---- B: does the Next image optimiser cope with the reader's redirect? ---- */
console.log("\n[B] /_next/image over the reader URL (this is what optimizedSrc builds)");
{
  const readerUrl = `/api/attachments?path=${encodeURIComponent(cmsPath)}`;
  const optimised = `${BASE}/_next/image?url=${encodeURIComponent(readerUrl)}&w=828&q=70`;
  const r = await fetch(optimised, { redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  check(
    "optimiser renders through the authorising reader",
    "200 + an image content-type",
    `HTTP ${r.status} ${ct}`,
    r.status === 200 && ct.startsWith("image/")
  );
  if (r.status !== 200) {
    console.log(`         body: ${(await r.text()).slice(0, 160)}`);
  }
}

/* ---- control: the optimiser over the current public URL (works today) ---- */
console.log("\n[control] /_next/image over the current PUBLIC url");
{
  const r = await fetch(`${BASE}/_next/image?url=${encodeURIComponent(cmsUrl)}&w=828&q=70`, { redirect: "manual" });
  const ct = r.headers.get("content-type") || "";
  check("optimiser over the public URL (today's path)", "200 + image", `HTTP ${r.status} ${ct}`, r.status === 200 && ct.startsWith("image/"));
}

console.log("\n" + "=".repeat(78));
const fail = results.filter(r => !r.ok).length;
console.log(fail === 0
  ? "FEASIBLE: CMS imagery can be served without public reads."
  : `NOT FEASIBLE as-is: ${fail} check(s) failed — see above.`);
console.log("=".repeat(78));
await end();
