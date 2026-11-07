import test from "node:test";
import assert from "node:assert/strict";
import { emailIntent, emailDestination } from "../src/lib/product-intent.ts";
test("subscription CTA destination survives sign-in and onboarding without arbitrary redirects", () => {
  const initial = new URLSearchParams(
    "next=plans&returnTo=https://evil.example&plan=elite",
  );
  assert.equal(emailIntent(initial), "?next=plans");
  assert.equal(
    emailDestination(new URLSearchParams(emailIntent(initial))),
    "/business/plans",
  );
  assert.equal(
    emailIntent(new URLSearchParams("next=https://evil.example")),
    "",
  );
  assert.equal(
    emailDestination(new URLSearchParams("next=https://evil.example")),
    null,
  );
});
