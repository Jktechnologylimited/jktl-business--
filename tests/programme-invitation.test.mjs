import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { invitationTerms } from "../src/lib/distribution/invitation-terms.ts";
import { emailIntent, emailDestination } from "../src/lib/product-intent.ts";
const require = createRequire(import.meta.url),
  token = "b".repeat(64);
function load(file, deps) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText,
  )((n) => (n in deps ? deps[n] : require(n)), m, m.exports);
  return m.exports;
}
const snapshot = {
  rateBps: 2000,
  currency: "NGN",
  holdDays: 30,
  products: ["website_subscription"],
  paidMonths: 12,
  netDefinition:
    "captured_less_tax_processing_refunds_chargebacks_and_third_party_costs",
  automaticPayouts: false,
  renewalsBeyondTerm: false,
  stackWithResellerDiscount: false,
};
test("terms are human readable and never invent missing rates or eligibility", () => {
  const text = invitationTerms(snapshot)
    .map((t) => t.description)
    .join(" ");
  assert.match(text, /20% of eligible net revenue/);
  assert.match(text, /30 days/);
  assert.match(text, /12 paid service months/);
  assert.match(text, /Website subscriptions/);
  assert.match(text, /refunds, chargebacks/);
  assert.doesNotMatch(
    text,
    /rateBps|website_subscription|captured_less|automaticPayouts/,
  );
  assert.equal(invitationTerms({}).length, 0);
  assert.equal(invitationTerms(null).length, 0);
  assert.ok(
    !invitationTerms({ currency: "NGN" }).some(
      (t) => t.label === "Proposed commission",
    ),
  );
  assert.match(invitationTerms({ rateBps: 0 })[0].description, /^0%/);
});
test("partner and affiliate intent stay distinct through signup, onboarding and login", () => {
  for (const [next, path] of [
    ["partner-invite", "partners"],
    ["affiliate-invite", "affiliates"],
  ]) {
    const initial = new URLSearchParams({ next, invite: token }),
      carried = new URLSearchParams(emailIntent(initial));
    assert.equal(carried.get("next"), next);
    assert.equal(carried.get("invite"), token);
    assert.equal(
      emailDestination(carried),
      `/${path}/invitation?token=${token}`,
    );
    assert.equal(
      emailIntent(
        new URLSearchParams({ next, invite: "https://evil.example" }),
      ),
      "",
    );
    assert.equal(
      emailDestination(new URLSearchParams({ next, invite: "bad" })),
      null,
    );
  }
});
test("valid legacy links redirect to their verified programme and rendered invitations contain no JSON", async () => {
  let stored = {
      name: "Fixture Partner",
      program: "partner",
      message: "Welcome to our partner programme.",
      terms: snapshot,
      expires_at: "2026-12-01T12:00:00Z",
    },
    session = null,
    calls = 0;
  const { ProgrammeInvitation } = load(
    "src/components/distribution/programme-invitation.tsx",
    {
      "server-only": {},
      "next/link": {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement("a", props, children),
      },
      "next/image": {
        __esModule: true,
        default: (props) => React.createElement("img", props),
      },
      "next/navigation": {
        redirect: (url) => {
          throw Error("REDIRECT:" + url);
        },
      },
      "@/lib/custom/service": {
        query: async () => {
          calls++;
          return stored ? [stored] : [];
        },
      },
      "@/lib/session": { getSession: async () => session },
      "@/lib/actions/affiliate-invitation-actions": {
        acceptAffiliateInvitationAction: () => {
          throw Error("No real acceptance in rendering tests");
        },
      },
      "@/components/distribution/action-form": {
        ActionForm: ({ children }) =>
          React.createElement("form", null, children),
      },
      "@/lib/distribution/invitation-terms": { invitationTerms },
    },
  );
  const page = (program) =>
    ProgrammeInvitation({ program, searchParams: Promise.resolve({ token }) });
  await assert.rejects(
    page("affiliate"),
    new RegExp("REDIRECT:/partners/invitation\\?token=" + token),
  );
  let html = renderToStaticMarkup(await page("partner"));
  assert.match(html, /Welcome to JKTL Partners/);
  assert.match(html, /20% of eligible net revenue/);
  assert.match(html, /next=partner-invite/);
  assert.doesNotMatch(
    html,
    /<pre|rateBps|automaticPayouts|website_subscription|next=affiliate-invite/,
  );
  assert.match(html, /Proposal · Not yet active/);
  assert.match(html, /WAT/);
  session = { userId: "fixture" };
  html = renderToStaticMarkup(await page("partner"));
  assert.match(html, /Accept partner invitation/);
  assert.match(html, /<input[^>]*type="checkbox"[^>]*required/);
  stored = { ...stored, program: "affiliate" };
  await assert.rejects(page("partner"), /REDIRECT:\/affiliates\/invitation/);
  html = renderToStaticMarkup(await page("affiliate"));
  assert.match(html, /Welcome to JKTL Affiliates/);
  assert.match(html, /Accept affiliate invitation/);
  stored = null;
  html = renderToStaticMarkup(await page("partner"));
  assert.match(html, /expired or has already been used/);
  assert.doesNotMatch(html, /name="consent"/);
  const before = calls;
  html = renderToStaticMarkup(
    await ProgrammeInvitation({
      program: "partner",
      searchParams: Promise.resolve({ token: "bad" }),
    }),
  );
  assert.match(html, /link is invalid/);
  assert.equal(calls, before);
});

test('partner reminders use partner branding and the partner invitation URL',async()=>{
 const before=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='fixture-no-real-delivery';let sent;
 try{
  const {remindAffiliateInvitations}=load('src/lib/distribution/activity.ts',{'server-only':{},'@/lib/custom/service':{query:async sql=>sql.startsWith('SELECT i.id')?[{id:'fixture'}]:sql.includes('RETURNING id,name,email,program')?[{id:'fixture',name:'Fixture Partner',email:'partner@example.test',program:'partner'}]:[]},'@/lib/email':{sendPartnerNoticeEmail:async mail=>{sent=mail;return {ok:true}}}});
  const result=await remindAffiliateInvitations();assert.equal(result.processed,1);assert.match(sent.path,/^\/partners\/invitation\?token=[a-f0-9]{64}$/);assert.match(sent.subject,/Partner invitation/);assert.match(sent.detail,/JKTL Partner invitation/);assert.equal(sent.replyCategory,'partner');
 }finally{if(before===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=before}
});
