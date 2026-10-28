/**
 * Tests for what an admin account may do.
 *
 * The whole point of this module is that a person can be given the partner
 * programme without being given the money. A regression here does not show up as a
 * broken page — it shows up as somebody who should not have been able to, doing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_NAV,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  navFor,
  normaliseRole,
} from "../src/lib/admin-permissions.ts";

test("an owner can do everything, by definition", () => {
  for (const item of ADMIN_NAV) {
    assert.equal(
      can("owner", item.capability),
      true,
      `owner should be able to ${item.capability}`,
    );
  }
  assert.equal(can("owner", "manage_team"), true);
  assert.equal(can("owner", "run_daily_job"), true);
});

test("an affiliate manager can run the partner programme and nothing else", () => {
  assert.equal(can("affiliate_manager", "manage_affiliates"), true);
  assert.equal(can("affiliate_manager", "record_payouts"), true);
  assert.equal(can("affiliate_manager", "view_insights"), true);

  // The three that matter: no broadcasts (emailing every customer), no lead
  // engine (importing and emailing strangers), no team management (creating an
  // account that could create an owner).
  assert.equal(can("affiliate_manager", "send_broadcasts"), false);
  assert.equal(can("affiliate_manager", "run_lead_engine"), false);
  assert.equal(can("affiliate_manager", "import_leads"), false);
  assert.equal(can("affiliate_manager", "manage_team"), false);
  assert.equal(
    can("affiliate_manager", "run_daily_job"),
    false,
    "the daily job collects money",
  );
});

test("an analyst can see numbers and change nothing", () => {
  assert.equal(can("analyst", "view_insights"), true);

  for (const capability of [
    "manage_affiliates",
    "record_payouts",
    "send_broadcasts",
    "run_lead_engine",
    "view_businesses",
    "manage_team",
    "run_daily_job",
  ]) {
    assert.equal(
      can("analyst", capability),
      false,
      `an analyst must not ${capability}`,
    );
  }
});

test("an unknown role fails closed to analyst", () => {
  // A typo in the database, or a row written before roles existed, must never
  // grant more access than intended.
  assert.equal(normaliseRole("owner!"), "analyst");
  assert.equal(normaliseRole(""), "analyst");
  assert.equal(normaliseRole(null), "analyst");
  assert.equal(normaliseRole(undefined), "analyst");
  assert.equal(normaliseRole("admin"), "analyst", "there is no 'admin' role");
});

test("known roles are passed through unchanged", () => {
  assert.equal(normaliseRole("owner"), "owner");
  assert.equal(normaliseRole("affiliate_manager"), "affiliate_manager");
  assert.equal(normaliseRole("analyst"), "analyst");
});

test("an unknown role gets no capability at all", () => {
  // Belt and braces: even if a caller skips normalisation, `can` must not fall
  // through to something permissive.
  assert.equal(can("nonsense", "view_insights"), false);
  assert.equal(can(undefined, "manage_team"), false);
});

test("navigation is filtered by capability, and never empty", () => {
  const ownerNav = navFor("owner");
  assert.equal(ownerNav.length, ADMIN_NAV.length);

  const managerNav = navFor("affiliate_manager").map((i) => i.label);
  assert.deepEqual(managerNav, [
    "Emails",
    "Distribution",
    "Partners",
    "Insights",
    "Affiliates",
  ]);

  const analystNav = navFor("analyst").map((i) => i.label);
  assert.deepEqual(analystNav, ["Insights"]);

  // Every role can reach at least one page, or signing in would be a dead end.
  for (const role of ["owner", "affiliate_manager", "analyst"]) {
    assert.ok(navFor(role).length >= 1, `${role} has no landing page`);
  }
});

test("every nav item is reachable by the role that sees it", () => {
  for (const role of ["owner", "affiliate_manager", "analyst"]) {
    for (const item of navFor(role)) {
      assert.equal(
        can(role, item.capability),
        true,
        `${role} sees ${item.label} but cannot use it`,
      );
      assert.ok(
        item.href.startsWith("/admin"),
        "every admin link stays under /admin",
      );
    }
  }
});

test("each role is described in a sentence a person understands", () => {
  for (const role of ["owner", "affiliate_manager", "analyst"]) {
    assert.ok(ROLE_LABEL[role].length > 3);
    assert.ok(
      ROLE_DESCRIPTION[role].length > 30,
      `${role} needs a real description`,
    );
    assert.ok(!/undefined/.test(ROLE_DESCRIPTION[role]));
  }
  // The manager's description should say what it can do, not just what it cannot.
  assert.match(ROLE_DESCRIPTION.affiliate_manager, /approve/i);
});

test("the client onboarding page needs the same capability as the lead engine", () => {
  // Marking somebody as an existing client and creating their account is lead-
  // engine work, so an affiliate manager — who can approve partners — must not be
  // able to create organizations.
  const clientNav = ADMIN_NAV.find((i) => i.href === "/admin/clients");
  assert.ok(clientNav, "the clients page should be in the navigation");
  assert.equal(clientNav.capability, "run_lead_engine");
  assert.equal(can("affiliate_manager", "run_lead_engine"), false);
  assert.equal(can("owner", "run_lead_engine"), true);
});

test("credential actions are owner-level, not affiliate-manager level", () => {
  // Resetting somebody's password and deleting their account are credential and
  // data-destruction actions. An affiliate manager curates partners; it does not
  // get to change how a business signs in or remove its records.
  for (const capability of ["view_businesses", "manage_team"]) {
    assert.equal(can("owner", capability), true);
    assert.equal(can("affiliate_manager", capability), false);
    assert.equal(can("analyst", capability), false);
  }
});
