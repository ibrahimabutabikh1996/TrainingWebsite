/* PHASE 2 — create the isolated test data.
 *
 * Every row created here is recorded in the run manifest by id. Cleanup deletes
 * by those ids and by nothing else: the database also holds pre-existing rows
 * that are out of scope, and a broad DELETE is exactly the mistake this file is
 * written to avoid.
 *
 * No file is uploaded anywhere. A "valid payment receipt" is an `upload_items`
 * row in state `confirmed` — which is all `confirmedPathsFor` reads — so the
 * receipt path is exercised end to end without a byte reaching storage.
 */
import bcrypt from "bcrypt";
import { db, loadManifest, saveManifest } from "./_lib.mjs";

const { q, end } = await db();
const m = loadManifest();
const RUN = m.runId;
const DAY = 86400000;

console.log("=".repeat(70));
console.log("PHASE 2 — SEEDING TEST DATA");
console.log(`Run ID: ${RUN}`);
console.log("=".repeat(70));

const TEST_PASSWORD = "TestOnly_Passw0rd_" + RUN.slice(-6);

/* The manifest is written after EVERY insert, not once at the end.
 *
 * It was written once at the end, and the first run aborted midway — which left
 * six rows in the database that nothing was tracking. A manifest that only
 * exists on the happy path is not a safety mechanism. */
const persist = () => saveManifest(m);

async function makeAccount(tag, passwordHash) {
  const username = `${RUN}_${tag}`;
  /* Resumable: the first attempt at this run aborted partway, so some of these
     rows already exist. Reuse them rather than colliding on the unique index —
     and never create a second row for the same tag. */
  const existing = await q(`select id, username from public.accounts where username = $1`, [username]);
  if (existing.length > 0) {
    console.log(`  account  ${tag.padEnd(10)} ${existing[0].id}  (reused)`);
    return existing[0];
  }
  /* `password_changed_at` deliberately in the past.
   *
   * The admin guards now run `sessionRefusal`, which refuses a token issued
   * before the last password change. A fixture stamped `now()` and a token
   * minted a moment later sit in the same second, and whether the comparison
   * falls one way or the other is then a race. An hour back makes every token
   * this harness mints unambiguously newer — except the deliberately stale one
   * in T12, which is minted a day back. */
  const [row] = await q(
    `insert into public.accounts (username, password, password_changed_at)
     values ($1, $2, now() - interval '1 hour') returning id, username`,
    [username, passwordHash]
  );
  m.accounts.push({ id: row.id, username: row.username, tag });
  persist();
  console.log(`  account  ${tag.padEnd(10)} ${row.id}  ${row.username}`);
  return row;
}

async function makeProfile(tag, accountId, { endsAt, suspended = false }) {
  const existing = await q(`select id from public.profiles where username = $1`, [`${RUN}_${tag}`]);
  if (existing.length > 0) {
    /* Reset it to the state this run expects, so a resumed seed starts from the
       same place a clean one would. Scoped to this run's own id. */
    await q(
      `update public.profiles set subscription_ends_at = $2, is_suspended = $3,
         data = jsonb_build_object('fullname', $4::text, 'gender', 'female', 'plan', 'plan2', '__test_run', $5::text)
       where id = $1`,
      [existing[0].id, endsAt, suspended, `${RUN}_${tag}`, RUN]
    );
    console.log(`  profile  ${tag.padEnd(10)} ${existing[0].id}  (reused, reset) ends=${endsAt ? endsAt.toISOString().slice(0, 10) : "null"} suspended=${suspended}`);
    return existing[0];
  }
  const data = {
    fullname: `${RUN}_${tag}`,
    gender: "female",
    plan: "plan2",
    /* Marks the row as this run's, inside the blob as well as the username, so
       a stray row is identifiable from either side. */
    __test_run: RUN,
  };
  const [row] = await q(
    `insert into public.profiles (username, data, user_id, subscription_ends_at, is_suspended)
     values ($1, $2::jsonb, $3, $4, $5) returning id`,
    [`${RUN}_${tag}`, JSON.stringify(data), accountId, endsAt, suspended]
  );
  m.profiles.push({ id: row.id, tag, accountId });
  persist();
  console.log(`  profile  ${tag.padEnd(10)} ${row.id}  ends=${endsAt ? endsAt.toISOString().slice(0, 10) : "null"} suspended=${suspended}`);
  return row;
}

/* An upload session already spent on nothing, carrying one confirmed receipt.
   Single-use by design, so each renewal attempt needs its own. */
async function makeReceiptSession(tag, accountId, profileId) {
  const [s] = await q(
    `insert into public.upload_sessions (scope, account_id, profile_id, status, expires_at, client_ip)
     values ('renewal', $1, $2, 'open', now() + interval '1 hour', '127.0.0.1')
     returning id`,
    [accountId, profileId]
  );
  const storagePath = `usersData/${s.id}/payment_receipt_${RUN}`;
  const [it] = await q(
    `insert into public.upload_items
       (session_id, field, storage_path, status, detected_type, mime, size_bytes, confirmed_at)
     values ($1, 'payment_receipt', $2, 'confirmed', 'jpeg', 'image/jpeg', 1024, now())
     returning id`,
    [s.id, storagePath]
  );
  m.uploadSessions.push({ id: s.id, tag });
  m.uploadItems.push({ id: it.id, sessionId: s.id, tag });
  persist();
  console.log(`  receipt  ${tag.padEnd(10)} session=${s.id}`);
  return s.id;
}

const now = Date.now();

console.log("\nB/C/D — trainees");
const bcryptHash = await bcrypt.hash(TEST_PASSWORD, 10);

const accActive = await makeAccount("active", bcryptHash);
const proActive = await makeProfile("active", accActive.id, { endsAt: new Date(now + 20 * DAY) });

const accExpired = await makeAccount("expired", bcryptHash);
const proExpired = await makeProfile("expired", accExpired.id, { endsAt: new Date(now - 1 * DAY) });

const accSusp = await makeAccount("suspended", bcryptHash);
const proSusp = await makeProfile("suspended", accSusp.id, { endsAt: new Date(now + 20 * DAY), suspended: true });

console.log("\nE — $2y$ account");
/* A row as an import tool would have written it: same algorithm, PHP's prefix.
 *
 * The measured fact, recorded here because the codebase asserts the opposite:
 * node-bcrypt 6.0.0 does NOT verify `$2y$`. `compare` returns false rather than
 * throwing, and genSalt refuses any minor but "a" and "b". The comment in
 * /api/auth/login claims "bcrypt verifies it" — it does not.
 *
 * That does not weaken the VULN-07 fix, it sharpens what the fix achieves:
 *   before — `$2y$` was treated as NOT a hash on two of the three paths, so the
 *            stored hash itself was accepted as the password (a hole);
 *   after  — it is treated as a hash on all three, compare returns false, and
 *            the account simply cannot authenticate (a lockout).
 * A lockout is the safe failure. See finding N-7. */
const y2Hash = "$2y$" + bcryptHash.slice(4);
const verifyY2 = await bcrypt.compare(TEST_PASSWORD, y2Hash);
console.log(`  generated prefix : ${bcryptHash.slice(0, 4)}`);
console.log(`  stored prefix    : ${y2Hash.slice(0, 4)}`);
console.log(`  node-bcrypt verifies $2y$ : ${verifyY2}  <- FALSE is the measured behaviour (N-7)`);
const accY2 = await makeAccount("y2hash", y2Hash);
const proY2 = await makeProfile("y2hash", accY2.id, { endsAt: new Date(now + 20 * DAY) });

console.log("\nF — receipt upload sessions (no bytes uploaded)");
const receipts = {
  active1: await makeReceiptSession("active1", accActive.id, proActive.id),
  active2: await makeReceiptSession("active2", accActive.id, proActive.id),
  active3: await makeReceiptSession("active3", accActive.id, proActive.id),
  active4: await makeReceiptSession("active4", accActive.id, proActive.id),
  expired1: await makeReceiptSession("expired1", accExpired.id, proExpired.id),
  susp1: await makeReceiptSession("susp1", accSusp.id, proSusp.id),
};

m.fixtures = {
  password: TEST_PASSWORD,
  accounts: {
    active: accActive.id, expired: accExpired.id, suspended: accSusp.id, y2hash: accY2.id,
  },
  usernames: {
    active: accActive.username, expired: accExpired.username,
    suspended: accSusp.username, y2hash: accY2.username,
  },
  profiles: {
    active: proActive.id, expired: proExpired.id, suspended: proSusp.id, y2hash: proY2.id,
  },
  receipts,
};

saveManifest(m);

console.log("\nSEED COMPLETE");
console.log(`  accounts        : ${m.accounts.length}`);
console.log(`  profiles        : ${m.profiles.length}`);
console.log(`  upload_sessions : ${m.uploadSessions.length}`);
console.log(`  upload_items    : ${m.uploadItems.length}`);
await end();
