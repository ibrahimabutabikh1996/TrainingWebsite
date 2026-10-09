/* Staff permissions — how a grant is read and how one is stored.
 *
 * Run with the rest of the suite:
 *   node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/
 *
 * Exercises `@/lib/staffPermissions`, which is pure: the guards in
 * `@/lib/authGuard` decide with these functions, and /api/admin/staff stores
 * only what `normalizePermissions` returns. Like p0-security.test.ts, nothing
 * here touches the database.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  STAFF_ACTIONS,
  STAFF_SECTIONS,
  firstAllowedPath,
  hasPermission,
  normalizePermissions,
  sectionLevel,
} from "@/lib/staffPermissions";

describe("hasPermission", () => {
  test("edit includes view", () => {
    assert.equal(hasPermission(["courses.edit"], "courses.view"), true);
    assert.equal(hasPermission(["courses.edit"], "courses.edit"), true);
  });

  test("view does not include edit", () => {
    assert.equal(hasPermission(["courses.view"], "courses.edit"), false);
  });

  test("one section's grant says nothing about another", () => {
    assert.equal(hasPermission(["courses.edit"], "diet.view"), false);
    assert.equal(hasPermission(["subscribers.edit"], "cms.view"), false);
  });

  test("subscriber actions are separate from the section", () => {
    assert.equal(hasPermission(["subscribers.edit"], "subscribers.delete"), false);
    assert.equal(hasPermission(["subscribers.view", "subscribers.renew"], "subscribers.renew"), true);
  });

  test("no grant, or an absent one, grants nothing", () => {
    assert.equal(hasPermission([], "subscribers.view"), false);
    assert.equal(hasPermission(undefined, "subscribers.view"), false);
  });
});

describe("sectionLevel", () => {
  test("reads none, view and edit", () => {
    assert.equal(sectionLevel([], "cms"), "none");
    assert.equal(sectionLevel(["cms.view"], "cms"), "view");
    assert.equal(sectionLevel(["cms.edit"], "cms"), "edit");
  });

  test("edit wins when both are present", () => {
    assert.equal(sectionLevel(["diet.view", "diet.edit"], "diet"), "edit");
  });
});

describe("normalizePermissions — what may be stored", () => {
  test("unknown strings and non-strings are dropped", () => {
    assert.deepEqual(normalizePermissions(["courses.view", "courses.admin", "staff.edit", 5, null, {}]), [
      "courses.view",
    ]);
  });

  test("anything that is not an array becomes an empty grant", () => {
    for (const value of ["courses.edit", null, undefined, 42, { courses: "edit" }]) {
      assert.deepEqual(normalizePermissions(value), []);
    }
  });

  test("one level per section, edit kept over view", () => {
    assert.deepEqual(normalizePermissions(["exercises.view", "exercises.edit", "exercises.view"]), [
      "exercises.edit",
    ]);
  });

  test("subscriber actions are dropped while the subscribers section is hidden", () => {
    assert.deepEqual(normalizePermissions(["courses.edit", "subscribers.renew", "subscribers.delete"]), [
      "courses.edit",
    ]);
  });

  test("subscriber actions are kept alongside the section", () => {
    assert.deepEqual(
      normalizePermissions(["subscribers.view", "subscribers.renew", "subscribers.suspend"]),
      ["subscribers.view", "subscribers.renew", "subscribers.suspend"]
    );
  });

  test("a full grant survives intact", () => {
    const full = [
      ...STAFF_SECTIONS.map((s) => `${s.key}.edit`),
      ...STAFF_ACTIONS.map((a) => a.key),
    ];
    assert.deepEqual(normalizePermissions(full), full);
  });

  test("normalising twice changes nothing", () => {
    const once = normalizePermissions(["diet.view", "subscribers.edit", "subscribers.accounts", "x"]);
    assert.deepEqual(normalizePermissions(once), once);
  });
});

describe("firstAllowedPath — where a staff member is sent", () => {
  test("the first section they may view, in panel order", () => {
    assert.equal(firstAllowedPath(["cms.view", "diet.edit"]), "/admin/diet");
    assert.equal(firstAllowedPath(["subscribers.view", "courses.edit"]), "/admin");
  });

  test("every section's landing screen is reachable", () => {
    for (const section of STAFF_SECTIONS) {
      assert.equal(firstAllowedPath([`${section.key}.view`]), section.home);
    }
  });

  test("null when no section is granted, even with subscriber actions", () => {
    assert.equal(firstAllowedPath([]), null);
    assert.equal(firstAllowedPath(["subscribers.renew"]), null);
    assert.equal(firstAllowedPath(undefined), null);
  });
});
