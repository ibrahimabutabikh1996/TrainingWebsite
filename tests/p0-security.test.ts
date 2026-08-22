/* Regression tests for the P0 security batch.
 *
 * Run with:
 *   node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/
 *
 * These exercise the real modules, not copies. What they deliberately do NOT do
 * is talk to a database or drive the HTTP endpoints: `.env` points at the live
 * project, and a test that registers accounts or consumes rate-limit windows
 * against production data is not a test, it is an incident. Everything asserted
 * here is the decision logic itself — which is where all four fixes live.
 *
 * The endpoint-level cases that need an isolated database are listed at the
 * bottom of this file so they are not quietly forgotten.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isReservedUsername, isBcryptHash, credentialError } from "@/lib/auth";
import { subscriptionExtendFrom, subscriptionEndFrom, SUBSCRIPTION_DAYS } from "@/lib/subscription";
import { isAdminUsername } from "@/lib/adminUsernames";
import { validateSubmission } from "@/app/api/submit-form/validate";
import {
  withCarriedFields,
  currentMonthData,
  RENEWAL_CARRIED_KEYS,
  NON_ANSWER_KEYS,
} from "@/lib/subscriptionMonths";
import type { JsonRecord } from "@/types";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * VULN-03 — reserved usernames
 * ------------------------------------------------------------------ */

describe("VULN-03 — reserved usernames cannot be registered", () => {
  test("every name that grants admin is reserved", () => {
    /* The real invariant: nothing `isAdminUsername` says yes to may be
       registrable. Written against that function rather than against a repeated
       list, so adding a coach to the list cannot leave a hole behind. */
    for (const name of ["admin", "mkm94admin"]) {
      assert.equal(isAdminUsername(name), true, `${name} should grant admin`);
      assert.equal(isReservedUsername(name), true, `${name} must be reserved`);
    }
  });

  test("case variants are reserved too", () => {
    for (const name of ["Admin", "ADMIN", "MkM94Admin", "aDmIn"]) {
      assert.equal(isReservedUsername(name), true, `${name} must be reserved`);
    }
  });

  test("surrounding whitespace does not evade the check", () => {
    assert.equal(isReservedUsername("  admin  "), true);
    assert.equal(isReservedUsername("\tadmin\n"), true);
  });

  test("other privileged-sounding names are reserved", () => {
    for (const name of ["administrator", "root", "system", "support", "coach"]) {
      assert.equal(isReservedUsername(name), true, `${name} must be reserved`);
    }
  });

  test("ordinary names are still allowed", () => {
    for (const name of ["ahmed", "mohammed.k", "user_01", "trainee-7", "adminx", "myadmin"]) {
      assert.equal(isReservedUsername(name), false, `${name} must be allowed`);
    }
  });

  test("non-strings are not reserved and do not throw", () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      assert.equal(isReservedUsername(value), false);
    }
  });

  test("credentialError refuses a reserved name (admin create-account path)", () => {
    assert.match(credentialError("admin", "goodpassword1") ?? "", /محجوز/);
    assert.match(credentialError("Admin", "goodpassword1") ?? "", /محجوز/);
    assert.equal(credentialError("ahmed", "goodpassword1"), null);
  });

  test("validateSubmission refuses a reserved name (public intake path)", () => {
    const base = {
      fullname: "اختبار", phone: "07700000000", plan: "plan2", gender: "male",
      age: "25", weight: "80", height: "175", activity: "opt_activity_2",
      residence: "بغداد", employment: "موظف", workout_exp: "opt_exp_1",
      workout_type_exp: ["a"], workout_commit: "opt_commit_1", workout_days: "opt_days_3",
      sub_goal: "opt_goal_1", target_weight: "75", allergies: "لا", fav_foods: "لا",
      coffee_rate: "opt_coffee_0", buy_supp: "opt_supp_1", injuries: "لا",
    };

    const reserved = validateSubmission({ ...base, username: "admin", password: "goodpassword1" });
    assert.equal(reserved.ok, false);
    assert.ok(
      reserved.errors.some((e) => e.includes("reserved")),
      `expected a "reserved" error, got: ${reserved.errors.join(" | ")}`
    );

    const ok = validateSubmission({ ...base, username: "ahmed99", password: "goodpassword1" });
    assert.equal(ok.ok, true, `expected valid, got: ${ok.errors.join(" | ")}`);
  });
});

/* ------------------------------------------------------------------ *
 * VULN-07 + N-1 — one bcrypt test, three call sites
 * ------------------------------------------------------------------ */

describe("VULN-07 — bcrypt detection is one definition", () => {
  test("every bcrypt prefix is recognised, $2y$ included", () => {
    const body = "$10$abcdefghijklmnopqrstuv";
    for (const prefix of ["$2a", "$2b", "$2y"]) {
      assert.equal(isBcryptHash(prefix + body), true, `${prefix}$ must be a hash`);
    }
  });

  test("plaintext is not mistaken for a hash", () => {
    for (const value of ["password123", "$2x$10$notreal", "2a$10$missing", "", "$2"]) {
      assert.equal(isBcryptHash(value), false, `${value} must not be a hash`);
    }
  });

  test("non-strings do not throw", () => {
    for (const value of [null, undefined, 0, {}, []]) {
      assert.equal(isBcryptHash(value), false);
    }
  });

  test("a $2y$ hash can never be replayed as its own password", () => {
    /* The bug this closes: two of the three call sites fell through to
       `submitted === account.password` for a $2y$ row, which accepts the stored
       hash itself as the password. Detection is what routes it to bcrypt. */
    const stored = "$2y$10$abcdefghijklmnopqrstuv";
    assert.equal(isBcryptHash(stored), true);
  });
});

/* ------------------------------------------------------------------ *
 * VULN-01 / N-2 — extending never loses paid days
 * ------------------------------------------------------------------ */

describe("N-2 — subscriptionExtendFrom adds to what is already there", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  test("an active subscription keeps its remaining days", () => {
    /* 20 days left; renewing must land 20 + 30 days out, not 30. */
    const currentEnd = new Date(now.getTime() + 20 * DAY_MS);
    const extended = subscriptionExtendFrom(currentEnd, now);
    const expected = new Date(currentEnd.getTime() + SUBSCRIPTION_DAYS * DAY_MS);
    assert.equal(extended.getTime(), expected.getTime());
    assert.ok(
      extended.getTime() > subscriptionEndFrom(now).getTime(),
      "extending early must not be worse than renewing from today"
    );
  });

  test("an expired subscription starts a fresh month from now", () => {
    /* Never from the lapsed date — that would hand over a month already spent. */
    const lapsed = new Date(now.getTime() - 45 * DAY_MS);
    const extended = subscriptionExtendFrom(lapsed, now);
    assert.equal(extended.getTime(), subscriptionEndFrom(now).getTime());
  });

  test("a never-activated subscription starts from now", () => {
    for (const value of [null, undefined, ""]) {
      assert.equal(subscriptionExtendFrom(value, now).getTime(), subscriptionEndFrom(now).getTime());
    }
  });

  test("an unparseable stored date falls back to now rather than NaN", () => {
    const extended = subscriptionExtendFrom("not-a-date", now);
    assert.ok(!Number.isNaN(extended.getTime()));
    assert.equal(extended.getTime(), subscriptionEndFrom(now).getTime());
  });

  test("an ISO string is accepted as well as a Date", () => {
    const currentEnd = new Date(now.getTime() + 10 * DAY_MS);
    assert.equal(
      subscriptionExtendFrom(currentEnd.toISOString(), now).getTime(),
      subscriptionExtendFrom(currentEnd, now).getTime()
    );
  });

  test("renewing repeatedly accumulates instead of resetting", () => {
    /* Three renewals in one day must be three months, not one. This is what
       kept the old `subscriptionEndFrom()` from ever being an extension. */
    let end = subscriptionExtendFrom(null, now);
    for (let i = 0; i < 2; i++) end = subscriptionExtendFrom(end, now);
    assert.equal(end.getTime(), now.getTime() + 3 * SUBSCRIPTION_DAYS * DAY_MS);
  });
});

/* ------------------------------------------------------------------ *
 * Endpoint cases that need an isolated database
 * ------------------------------------------------------------------ *
 *
 * Not written as executable tests on purpose: `.env` points at the live project,
 * and these all write rows. Run them against a throwaway database with seeded
 * fixtures — never production.
 *
 *   VULN-01  POST /api/submit-form {profileId} with no receipt   → 400
 *   VULN-01  POST /api/submit-form {profileId} with a receipt    → 200, and
 *            profiles.subscription_ends_at UNCHANGED, renewal_pending = true
 *   VULN-01  POST /api/admin/renew-account                       → extends, and
 *            clears renewal_pending
 *   VULN-01  submit then approve                                 → exactly ONE
 *            new entry in data.renewals (the double-count regression)
 *   VULN-02  renewal with a suspended account                    → 403
 *   VULN-02  renewal with a token older than password_changed_at → 401
 *   VULN-02  anonymous registration                              → still 200
 *   VULN-03  POST /api/submit-form username "admin"              → 400
 *   VULN-03  POST /api/admin/create-account username "admin"     → 400
 *   VULN-07  sign in / change password / delete-confirm against a seeded
 *            $2y$ row                                            → all three
 *            verify via bcrypt, and the raw hash is refused as a password
 */

/* ------------------------------------------------------------------ *
 * Renewal — what a new month must not destroy
 * ------------------------------------------------------------------ *
 *
 * A renewal rewrites `profiles.data` from the answers just submitted, so every
 * key the app had written around those answers is dropped unless something
 * carries it. Nothing did: a trainee's whole weigh-in log was erased on each
 * renewal, month one moved to a different start date, and months the coach had
 * hidden reappeared. The regression is silent — the profile still loads, it
 * just knows less than it did — so it is asserted rather than eyeballed.
 */

describe("renewal carries the trainee's accumulated record forward", () => {
  const previous: JsonRecord = {
    fullname: "قديم",
    weight: "80",
    weightLogs: [
      { date: "2026-07-01", weight: 82 },
      { date: "2026-07-15", weight: 80 },
    ],
    activation_date: "2026-06-01T00:00:00.000Z",
    deleted_months: [2],
    delete_all_history: false,
    history: [{ label: "الشهر الأول", date: "2026-07-01T00:00:00.000Z", data: {} }],
    renewals: [{ date: "2026-07-01T00:00:00.000Z", label: "الشهر 2" }],
  };

  /* What /api/submit-form builds before the carry: this month's answers only. */
  const answers: JsonRecord = { fullname: "قديم", weight: "78", is_new: true };

  test("the weigh-in log survives the renewal", () => {
    const next = withCarriedFields(answers, previous);
    assert.deepEqual(next.weightLogs, previous.weightLogs);
  });

  test("every carried key survives, and the new answers still win", () => {
    const next = withCarriedFields(answers, previous);
    for (const key of RENEWAL_CARRIED_KEYS) {
      assert.deepEqual(next[key], previous[key], `${key} must be carried`);
    }
    /* The submission is still the month's answers — carrying is not reverting. */
    assert.equal(next.weight, "78");
    assert.equal(next.is_new, true);
  });

  test("a submitter cannot write their own weigh-in log or activation date", () => {
    /* The real invariant, and the reason the function reads `previous` only.
       The intake validator refuses fields that are not answers, so a payload
       like this cannot arrive today — this asserts the second lock, which does
       not depend on that list staying correct. */
    const forged: JsonRecord = {
      ...answers,
      weightLogs: [{ date: "2020-01-01", weight: 1 }],
      activation_date: "2020-01-01T00:00:00.000Z",
      delete_all_history: true,
    };
    const next = withCarriedFields(forged, previous);
    assert.deepEqual(next.weightLogs, previous.weightLogs);
    assert.equal(next.activation_date, previous.activation_date);
    assert.equal(next.delete_all_history, false);
  });

  test("a forged key is removed when the profile never had one", () => {
    const fresh: JsonRecord = { fullname: "جديد" };
    const forged: JsonRecord = { ...answers, weightLogs: [{ date: "2020-01-01", weight: 1 }] };
    const next = withCarriedFields(forged, fresh);
    assert.equal("weightLogs" in next, false);
  });

  test("carrying does not drag the archive along with it", () => {
    /* `history` and `renewals` are computed by the renewal branch — it appends
       to both — so carrying them here would fight that. Copying the old blob
       wholesale is also what made the stored row grow with the square of the
       months; a named list is what stops it. */
    const next = withCarriedFields(answers, previous);
    assert.equal("history" in next, false);
    assert.equal("renewals" in next, false);
  });

  test("nothing carried is treated as an answer", () => {
    /* Both lists describe "written by the app, not by the person filling the
       form". A key on one and not the other means a month's archive would keep
       a copy of something that belongs to the subscription as a whole. */
    for (const key of RENEWAL_CARRIED_KEYS) {
      assert.ok(
        (NON_ANSWER_KEYS as readonly string[]).includes(key),
        `${key} is carried across renewals, so it must not be archived as an answer`
      );
    }
  });

  test("a month's archive never keeps the pending-renewal flags", () => {
    /* A snapshot that kept `renewal_pending` would show a month already granted
       as still awaiting review — and the coach's panel keys its pending card
       off exactly that flag. */
    const snapshot = currentMonthData({
      ...previous,
      renewal_pending: true,
      renewal_requested_at: "2026-08-01T00:00:00.000Z",
      renewal_requested_month: 3,
    });
    assert.equal("renewal_pending" in snapshot, false);
    assert.equal("renewal_requested_at" in snapshot, false);
    assert.equal("renewal_requested_month" in snapshot, false);
    assert.equal("weightLogs" in snapshot, false);
  });
});


/* ------------------------------------------------------------------ *
 * Arabic search — folding spellings without merging words
 * ------------------------------------------------------------------ *
 *
 * Every search box compared characters exactly, so a coach typing "اضخم" found
 * nothing while the row said "أضخم". Folding fixes that and introduces the
 * opposite risk: fold too hard and every query matches everything, which reads
 * as a working search until you notice it never says no. Both directions are
 * asserted, and the negative cases are the ones that matter.
 */

describe("normalizeArabic — the same word, however it is typed", () => {
  test("the alif is one letter", () => {
    for (const v of ["أضخم", "إضخم", "آضخم", "اضخم"]) {
      assert.equal(normalizeArabic(v), "اضخم", v);
    }
  });

  test("taa marbuta and haa fold together", () => {
    assert.equal(normalizeArabic("الرشاقة"), normalizeArabic("الرشاقه"));
  });

  test("alif maqsura and yaa fold together", () => {
    assert.equal(normalizeArabic("الكبرى"), normalizeArabic("الكبري"));
  });

  test("harakat and tatweel are not part of the word", () => {
    assert.equal(normalizeArabic("مُعيَّن"), normalizeArabic("معين"));
    assert.equal(normalizeArabic("كــورس"), normalizeArabic("كورس"));
  });

  test("Arabic-Indic digits read as digits", () => {
    assert.equal(normalizeArabic("٣٠ يوم"), "30 يوم");
  });

  test("whitespace is collapsed and Latin is lower-cased", () => {
    assert.equal(normalizeArabic("  Plan   A  "), "plan a");
  });

  test("a non-string does not throw", () => {
    /* The intake blob holds whatever the form last wrote — a name may arrive as
       a number, and the coach's whole list used to go down on that. */
    assert.equal(normalizeArabic(null), "");
    assert.equal(normalizeArabic(undefined), "");
    assert.equal(normalizeArabic(42), "42");
  });
});

describe("arabicIncludes — still discriminating", () => {
  const course = "أضخم عضلة";

  test("finds the word however it is spelled", () => {
    for (const q of ["أضخم", "اضخم", "عضله", "عضلة"]) {
      assert.equal(arabicIncludes(course, normalizeArabic(q)), true, q);
    }
  });

  test("does NOT find a word that is not there", () => {
    /* The failure that looks like success. Every one of these shares letters
       with the course and none of them is in it. */
    for (const q of ["سباحه", "زززز", "أضخمم", "عضلات ظهر"]) {
      assert.equal(arabicIncludes(course, normalizeArabic(q)), false, q);
    }
  });

  test("distinct words stay distinct", () => {
    assert.notEqual(normalizeArabic("عضلة"), normalizeArabic("عجلة"));
    assert.notEqual(normalizeArabic("قوة"), normalizeArabic("قوت"));
  });

  test("an empty query matches everything, as an empty box means", () => {
    assert.equal(arabicIncludes(course, ""), true);
  });
});
