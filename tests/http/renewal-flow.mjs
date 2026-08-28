/* End-to-end verification of the renewal flow, over real HTTP.
 *
 * What the unit tests could not reach: `withCarriedFields` is provably correct
 * as a function, but only this says whether /api/submit-form actually calls it,
 * whether the duplicate guard fires, and whether the approval route — which
 * until now had no caller anywhere in the project — extends the subscription it
 * is handed.
 *
 * Self-contained: it seeds its own trainee, drives the flow, and deletes what it
 * created in a `finally`, by id, from a manifest written after every insert. The
 * database this points at holds real subscribers; nothing here selects, updates
 * or deletes a row this run did not create, and there is no statement in this
 * file that could.
 *
 * No mail is sent. EMAIL_USER/EMAIL_PASS are absent from .env, so the route logs
 * a warning and skips — which is deliberate, because the recipient hard-coded in
 * that handler is a real person.
 *
 *   npx next dev            (or preview_start "dev")
 *   node tests/http/renewal-flow.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import {
  db,
  mintSession,
  cookieFor,
  http,
  snapshot,
  record,
  results,
  daysBetween,
  BASE_URL,
} from "./_lib.mjs";

const RUN = "RENEWAL_TEST_" + crypto.randomBytes(3).toString("hex").toUpperCase();
const DAY = 86400000;
const MANIFEST = path.join(import.meta.dirname, ".renewal-manifest.json");

const m = {
  runId: RUN,
  accounts: [],
  profiles: [],
  uploadSessions: [],
  uploadItems: [],
};
/* Written after every insert, not once at the end. A manifest that only exists
   on the happy path is not a safety mechanism — an abort halfway leaves rows
   nothing is tracking. */
const persist = () => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

const { q, end } = await db();

console.log("=".repeat(72));
console.log("RENEWAL FLOW — END-TO-END");
console.log(`Server : ${BASE_URL}`);
console.log(`Run ID : ${RUN}`);
console.log("=".repeat(72));

let exitCode = 0;

try {
  /* ---------------------------------------------------------- pre-flight -- */

  const ping = await http("GET", "/api/profile");
  if (ping.status === 0 || ping.status >= 500) {
    throw new Error(`Server not answering (status ${ping.status}). Start the dev server first.`);
  }
  console.log(`\nPre-flight: /api/profile unauthenticated -> ${ping.status} (expect 401)`);

  /* --------------------------------------------------------------- seed -- */

  console.log("\nSEEDING");

  const hash = await bcrypt.hash("TestOnly_Passw0rd_" + RUN.slice(-6), 10);

  async function makeAccount(tag) {
    const username = `${RUN}_${tag}`;
    /* `password_changed_at` an hour back: `sessionRefusal` refuses a token
       issued before the last password change, and a fixture stamped now() with
       a token minted a moment later is a coin flip on the second boundary. */
    const [row] = await q(
      `insert into public.accounts (username, password, password_changed_at)
       values ($1, $2, now() - interval '1 hour') returning id, username`,
      [username, hash]
    );
    m.accounts.push({ id: row.id, username: row.username, tag });
    persist();
    console.log(`  account  ${tag.padEnd(9)} ${row.id}  ${row.username}`);
    return row;
  }

  /* The state a returning trainee is actually in: a subscription with days
     still on it, a weigh-in log built up over the month, an activation date
     older than the row, and one month the coach chose to hide. Every one of
     those is a thing the renewal used to destroy. */
  const ACTIVATION = new Date(Date.now() - 40 * DAY).toISOString();
  const WEIGHT_LOGS = [
    { date: "2026-07-20", weight: 82 },
    { date: "2026-08-05", weight: 80.5 },
  ];

  async function makeProfile(tag, accountId, endsAt) {
    const data = {
      fullname: `${RUN}_${tag}`,
      gender: "female",
      plan: "plan2",
      weightLogs: WEIGHT_LOGS,
      activation_date: ACTIVATION,
      deleted_months: [1],
      delete_all_history: false,
      __test_run: RUN,
    };
    const [row] = await q(
      `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
       values ($1, $2::jsonb, $3, $4, false) returning id`,
      [`${RUN}_${tag}`, JSON.stringify(data), accountId, endsAt]
    );
    m.profiles.push({ id: row.id, tag, accountId });
    persist();
    console.log(`  profile  ${tag.padEnd(9)} ${row.id}  ends=${endsAt.toISOString().slice(0, 10)}`);
    return row;
  }

  /* A confirmed receipt without a byte reaching storage: `confirmedPathsFor`
     reads `upload_items` in state 'confirmed' and nothing else. Single-use by
     design, so each submission needs its own. */
  async function makeReceipt(tag, accountId, profileId) {
    const [s] = await q(
      `insert into public.upload_sessions (scope, account_id, profile_id, status, expires_at, client_ip)
       values ('renewal', $1, $2, 'open', now() + interval '1 hour', '127.0.0.1') returning id`,
      [accountId, profileId]
    );
    const [it] = await q(
      `insert into public.upload_items
         (session_id, field, storage_path, status, detected_type, mime, size_bytes, confirmed_at)
       values ($1, 'payment_receipt', $2, 'confirmed', 'jpeg', 'image/jpeg', 1024, now()) returning id`,
      [s.id, `usersData/${s.id}/payment_receipt_${RUN}`]
    );
    m.uploadSessions.push({ id: s.id, tag });
    m.uploadItems.push({ id: it.id, sessionId: s.id, tag });
    persist();
    return s.id;
  }

  /* Five days left on purpose. An extension must add to what remains; a reset
     would be indistinguishable from an extension if the subscription had
     already lapsed. */
  const startEnd = new Date(Date.now() + 5 * DAY);

  const acc = await makeAccount("main");
  const pro = await makeProfile("main", acc.id, startEnd);

  const other = await makeAccount("other");
  await makeProfile("other", other.id, new Date(Date.now() + 20 * DAY));

  const receipts = {
    first: await makeReceipt("r1", acc.id, pro.id),
    second: await makeReceipt("r2", acc.id, pro.id),
    third: await makeReceipt("r3", acc.id, pro.id),
  };
  console.log(`  receipts           3 upload sessions (no bytes uploaded)`);

  /* ------------------------------------------------------------ cookies -- */

  const traineeCookie = cookieFor(mintSession({ id: acc.id, username: acc.username }));
  const otherCookie = cookieFor(mintSession({ id: other.id, username: other.username }));
  /* `requireAdmin` reads the role off the username in the token and confirms
     the account row still exists; no admin row is created for this run. */
  const adminCookie = cookieFor(mintSession({ id: acc.id, username: "admin" }));

  function payload() {
    return {
      fullname: `${RUN}_form`, phone: "07700000000", plan: "plan2",
      /* female: the male branch additionally requires body_photos, and this run
         uploads no files. */
      gender: "female", age: "28", weight: "78", height: "165",
      activity: "opt_activity_2", residence: "بغداد", employment: "موظفة",
      meas_arm: "30", meas_waist: "70", meas_hips: "95", meas_leg: "50",
      workout_exp: "opt_exp_1", workout_type_exp: ["opt_type_gym"],
      workout_commit: "opt_commit_1", workout_days: "opt_days_3",
      sub_goal: "opt_goal_1", target_weight: "65",
      allergies: "لا يوجد", fav_foods: "دجاج", coffee_rate: "opt_coffee_0",
      buy_supp: "opt_supp_1", injuries: "لا يوجد",
    };
  }

  const submit = (cookie, profileId, uploadSessionId) =>
    http("POST", "/api/submit-form", {
      cookie,
      body: { data: JSON.stringify(payload()), profileId, uploadSessionId },
    });

  /** The blob as stored, for the assertions the snapshot does not cover. */
  const blob = async (id) => {
    const [r] = await q(`select data from public.profiles where id = $1`, [id]);
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
  };

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* =================================================================== T1 == */

  console.log("\nT1 — the trainee submits a renewal");

  const before1 = await snapshot(q, pro.id);
  const r1 = await submit(traineeCookie, pro.id, receipts.first);
  const after1 = await snapshot(q, pro.id);
  const blob1 = await blob(pro.id);

  record({ test: "T1.0 submission accepted", http: r1.status, pass: r1.status === 200,
    note: r1.status === 200 ? "" : JSON.stringify(r1.json) });

  record({ test: "T1.1 renewal_pending raised", pass: after1.renewal_pending === true,
    note: `pending=${after1.renewal_pending}` });

  record({ test: "T1.2 month asked for is recorded", pass: after1.renewal_requested_month === 2,
    note: `month=${after1.renewal_requested_month}` });

  /* The financial invariant. The request must not award itself a day. */
  record({ test: "T1.3 subscription NOT extended by the request",
    pass: after1.subscription_ends_at === before1.subscription_ends_at,
    note: `${before1.subscription_ends_at} -> ${after1.subscription_ends_at}` });

  record({ test: "T1.4 no month granted (renewals untouched)",
    pass: after1.renewals_count === 0, note: `renewals=${after1.renewals_count}` });

  record({ test: "T1.5 closing month archived", pass: after1.history_count === 1,
    note: `history=${before1.history_count} -> ${after1.history_count}` });

  /* The four the renewal used to destroy. */
  record({ test: "T1.6 weigh-in log SURVIVES the renewal",
    pass: eq(blob1.weightLogs, WEIGHT_LOGS),
    note: `logs=${JSON.stringify(blob1.weightLogs)}` });

  record({ test: "T1.7 activation_date survives", pass: blob1.activation_date === ACTIVATION,
    note: `${blob1.activation_date}` });

  record({ test: "T1.8 hidden months stay hidden", pass: eq(blob1.deleted_months, [1]),
    note: `deleted_months=${JSON.stringify(blob1.deleted_months)}` });

  record({ test: "T1.9 this month's answers are the new ones", pass: blob1.weight === "78",
    note: `weight=${blob1.weight}` });

  /* The archive must hold the month as it was lived, not the bookkeeping. */
  const snap = Array.isArray(blob1.history) ? blob1.history[0]?.data ?? {} : {};
  record({ test: "T1.10 archive carries no bookkeeping",
    pass: !("weightLogs" in snap) && !("renewal_pending" in snap) && !("activation_date" in snap),
    note: `snapshot keys=${Object.keys(snap).length}` });

  /* =================================================================== T2 == */

  console.log("\nT2 — the trainee submits again while the first is pending");

  const r2 = await submit(traineeCookie, pro.id, receipts.second);
  const after2 = await snapshot(q, pro.id);

  record({ test: "T2.0 second submission refused", http: r2.status, pass: r2.status === 409,
    note: r2.json?.error ?? "" });

  record({ test: "T2.1 no phantom month added to history",
    pass: after2.history_count === 1, note: `history=${after2.history_count}` });

  const [sess2] = await q(`select status from public.upload_sessions where id = $1`, [receipts.second]);
  record({ test: "T2.2 the refused attempt did not burn its receipt",
    pass: sess2.status === "open", note: `session=${sess2.status}` });

  /* =================================================================== T3 == */

  console.log("\nT3 — authorisation on the approval route");

  const rAnon = await http("POST", "/api/admin/renew-account", { body: { profileId: pro.id } });
  record({ test: "T3.0 anonymous cannot approve", http: rAnon.status, pass: rAnon.status === 401 });

  const rTrainee = await http("POST", "/api/admin/renew-account", {
    cookie: traineeCookie, body: { profileId: pro.id },
  });
  record({ test: "T3.1 a trainee cannot approve their own", http: rTrainee.status,
    pass: rTrainee.status === 403 });

  const rBadId = await http("POST", "/api/admin/renew-account", {
    cookie: adminCookie, body: { profileId: "not-a-uuid" },
  });
  record({ test: "T3.2 malformed id refused as 400, not 500", http: rBadId.status,
    pass: rBadId.status === 400, note: rBadId.json?.error ?? "" });

  const rOther = await submit(otherCookie, pro.id, receipts.third);
  record({ test: "T3.3 another trainee cannot renew this profile", http: rOther.status,
    pass: rOther.status === 403 });

  const afterAuthz = await snapshot(q, pro.id);
  record({ test: "T3.4 none of the refusals moved the subscription",
    pass: afterAuthz.subscription_ends_at === before1.subscription_ends_at,
    note: `${afterAuthz.subscription_ends_at}` });

  /* =================================================================== T4 == */

  console.log("\nT4 — the coach approves");

  const r4 = await http("POST", "/api/admin/renew-account", {
    cookie: adminCookie, body: { profileId: pro.id },
  });
  const after4 = await snapshot(q, pro.id);
  const blob4 = await blob(pro.id);

  record({ test: "T4.0 approval accepted", http: r4.status, pass: r4.status === 200,
    note: r4.status === 200 ? "" : JSON.stringify(r4.json) });

  /* Added to what was left, not measured from today: five days remained, so the
     new end is thirty days past the old one. */
  const added = daysBetween(after4.subscription_ends_at, before1.subscription_ends_at);
  record({ test: "T4.1 a month is ADDED to the days already paid for", pass: added === 30,
    note: `+${added} days (5 remaining were kept)` });

  record({ test: "T4.2 exactly one month granted — no double count",
    pass: after4.renewals_count === 1, note: `renewals=${after4.renewals_count}` });

  record({ test: "T4.3 the pending flags are cleared",
    pass: after4.renewal_pending === null && after4.renewal_requested_month === null,
    note: `pending=${after4.renewal_pending}` });

  record({ test: "T4.4 history not touched by the approval",
    pass: after4.history_count === 1, note: `history=${after4.history_count}` });

  record({ test: "T4.5 weigh-in log still intact after approval",
    pass: eq(blob4.weightLogs, WEIGHT_LOGS) });

  /* =================================================================== T5 == */

  console.log("\nT5 — the trainee is not locked out afterwards");

  const r5 = await submit(traineeCookie, pro.id, receipts.second);
  const after5 = await snapshot(q, pro.id);
  const blob5 = await blob(pro.id);

  record({ test: "T5.0 a new request is accepted once the last was decided",
    http: r5.status, pass: r5.status === 200, note: r5.json?.error ?? "" });

  record({ test: "T5.1 it asks for the following month",
    pass: after5.renewal_requested_month === 3, note: `month=${after5.renewal_requested_month}` });

  record({ test: "T5.2 second month archived", pass: after5.history_count === 2,
    note: `history=${after5.history_count}` });

  record({ test: "T5.3 the log has survived two renewals and an approval",
    pass: eq(blob5.weightLogs, WEIGHT_LOGS) });

  record({ test: "T5.4 still no days granted by the request",
    pass: after5.subscription_ends_at === after4.subscription_ends_at });

  /* =================================================================== T6 == */

  console.log("\nT6 — rejection clears the request without taking anything back");

  /* The reject path is a server action, which cannot be called over HTTP
     without the build's action id. What it does is `delete` the three flags on
     the blob and nothing else — so this asserts the state that leaves, and that
     the trainee can submit again from it. The guard on the action itself
     (`requireAdminAction`) is the same one the three shipped history actions
     use. */
  const endsBeforeReject = after5.subscription_ends_at;
  await q(
    `update public.profiles
       set data = data - 'renewal_pending' - 'renewal_requested_at' - 'renewal_requested_month'
     where id = $1`,
    [pro.id]
  );
  const afterReject = await snapshot(q, pro.id);

  record({ test: "T6.0 rejection leaves no pending request",
    pass: afterReject.renewal_pending === null });

  record({ test: "T6.1 rejection does not shorten the subscription",
    pass: afterReject.subscription_ends_at === endsBeforeReject });

  record({ test: "T6.2 rejection does not revoke a granted month",
    pass: afterReject.renewals_count === 1, note: `renewals=${afterReject.renewals_count}` });

  const r6 = await submit(traineeCookie, pro.id, receipts.third);
  record({ test: "T6.3 the trainee can submit a corrected request", http: r6.status,
    pass: r6.status === 200, note: r6.json?.error ?? "" });

  /* ------------------------------------------------------------- report -- */

  const failed = results.filter((r) => r.pass === false);
  console.log("\n" + "=".repeat(72));
  console.log(`RESULT: ${results.filter((r) => r.pass === true).length} passed, ${failed.length} failed`);
  console.log("=".repeat(72));
  if (failed.length > 0) {
    for (const f of failed) console.log(`  FAIL ${f.test} — ${f.note ?? ""}`);
    exitCode = 1;
  }
} catch (error) {
  console.error("\nRUN ABORTED:", error.message);
  exitCode = 1;
} finally {
  /* ------------------------------------------------------------ cleanup -- */

  console.log("\nCLEANUP — by id, from this run's manifest, and from nothing else");

  const del = async (label, sql, ids) => {
    if (ids.length === 0) return console.log(`  ${label.padEnd(16)} 0`);
    const rows = await q(sql, [ids]);
    console.log(`  ${label.padEnd(16)} ${rows.length} / ${ids.length}`);
  };

  try {
    await del("upload_items", `delete from public.upload_items where id = any($1::uuid[]) returning id`,
      m.uploadItems.map((r) => r.id));
    await del("upload_sessions", `delete from public.upload_sessions where id = any($1::uuid[]) returning id`,
      m.uploadSessions.map((r) => r.id));
    await del("profiles", `delete from public.profiles where id = any($1::uuid[]) returning id`,
      m.profiles.map((r) => r.id));
    await del("accounts", `delete from public.accounts where id = any($1::uuid[]) returning id`,
      m.accounts.map((r) => r.id));

    /* Only the synthetic addresses `_lib.mjs` hands out, and only this run's
       profile keys. The table holds counters this run did not create. */
    const keys = [];
    for (let i = 1; i <= 250; i++) keys.push(`submit-form:203.0.113.${i}`);
    for (const p of m.profiles) keys.push(`submit-form:profile:${p.id}`);
    await del("login_attempts", `delete from public.login_attempts where key = any($1::text[]) returning key`, keys);

    const [left] = await q(
      `select (select count(*) from public.accounts where username like $1)
            + (select count(*) from public.profiles where username like $1) as n`,
      [`${RUN}%`]
    );
    console.log(`  remaining for this run: ${left.n}`);
    if (Number(left.n) !== 0) exitCode = 1;

    if (fs.existsSync(MANIFEST)) fs.unlinkSync(MANIFEST);
  } catch (e) {
    console.error(`  CLEANUP FAILED — not widening the delete. Manifest kept at ${MANIFEST}`);
    console.error(`  ${e.message}`);
    exitCode = 1;
  }

  await end();
  process.exit(exitCode);
}
