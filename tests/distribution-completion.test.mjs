import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { pushSubscription } from "../src/lib/support/model.ts";
import { readFileSync, readdirSync } from "node:fs";
import * as crypto from "node:crypto";
import * as addresses from "../src/lib/mail/addresses.ts";
function load(file, deps) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) => {
      if (!(n in deps)) throw Error("Missing " + n);
      return deps[n];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const user = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
test("secure Affiliate invitations reuse existing identity, reject mismatched/replayed tokens and preserve draft policies; lifecycle preserves financial obligations", async () => {
  const db = new PGlite();
  try {
    for (const f of readdirSync(new URL("../migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        readFileSync(
          new URL("../migrations/" + f, import.meta.url),
          "utf8",
        ).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ""),
      );
    const query = async (s, p = []) => (await db.query(s, p)).rows;
    await query(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Invited User','invite@example.test','original-password-hash'),($2,'Other User','other@example.test','other-hash')",
      [user, other],
    );
    const policy =
      (
        await query(
          "SELECT id FROM distribution_policies WHERE code='proposed-affiliate-v2'",
        )
      )[0] ||
      (
        await query(
          "SELECT id FROM distribution_policies WHERE program='AFFILIATE' AND state='DRAFT'",
        )
      )[0];
    assert.ok(policy);
    let current = user,
      sent = [],
      session = null,
      allowed = true;
    const deps = {
      "@/lib/mail/addresses": addresses,
      "next/server": { after() {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => {},
      },
      "node:crypto": crypto,
      "@/lib/custom/service": { query },
      "@/lib/admin-session": {
        requireAdminCapability: async () => {
          if (!allowed) throw Error("Denied");
          return { id: "owner", role: "owner" };
        },
      },
      "@/lib/session": { requireSession: async () => ({ userId: current }) },
      "@/lib/affiliate-session": {
        startAffiliateSession: async (id) => {
          session = id;
        },
      },
      "@/lib/db/auth": {
        hashPassword: async () => "unusable-program-password",
      },
      "@/lib/email": {
        sendPartnerNoticeEmail: async (p) => {
          sent.push(p);
          return { ok: true };
        },
      },
      "@/lib/support/service": { rate: async () => {} },
      "next/cache": { revalidatePath() {} },
      "next/navigation": {
        redirect: (url) => {
          throw Error("REDIRECT " + url);
        },
      },
    };
    const a = load("../src/lib/actions/affiliate-invitation-actions.ts", deps),
      f = new FormData();
    f.set("name", "Invited User");
    f.set("email", "invite@example.test");
    f.set("policy", policy.id);
    await a.inviteAffiliateAction(f);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].category, "invitation");
    const token = new URL(
      "https://example.test" + sent[0].path,
    ).searchParams.get("token");
    const invite = (await query("SELECT * FROM affiliate_invitations"))[0];
    assert.notEqual(invite.token_hash, token);
    assert.equal(
      invite.token_hash,
      crypto.createHash("sha256").update(token).digest("hex"),
    );
    const accept = new FormData();
    accept.set("token", token);
    accept.set("consent", "on");
    current = other;
    await assert.rejects(
      a.acceptAffiliateInvitationAction(accept),
      /different email/,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM affiliates"))[0].n,
      0,
    );
    current = user;
    await assert.rejects(
      a.acceptAffiliateInvitationAction(accept),
      /REDIRECT \/affiliates/,
    );
    assert.ok(session);
    assert.equal((await query("SELECT count(*)::int n FROM users"))[0].n, 2);
    assert.equal(
      (await query("SELECT password_hash FROM users WHERE id=$1", [user]))[0]
        .password_hash,
      "original-password-hash",
    );
    await assert.rejects(
      a.acceptAffiliateInvitationAction(accept),
      /already used/,
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM affiliates"))[0].n,
      1,
    );
    assert.equal(
      (
        await query("SELECT state FROM distribution_policies WHERE id=$1", [
          policy.id,
        ])
      )[0].state,
      "DRAFT",
    );
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_contracts"))[0].n,
      0,
    );
    allowed = false;
    await assert.rejects(a.inviteAffiliateAction(f), /Denied/);
    allowed = true;
    const activity = load("../src/lib/distribution/activity.ts", {
      "server-only": {},
      "node:crypto": crypto,
      "@/lib/email": { sendPartnerNoticeEmail: async () => ({ ok: true }) },
      "@/lib/custom/service": { query },
    });
    await query(
      "UPDATE affiliate_activity SET last_qualified_at=now()-interval '110 days'",
    );
    await activity.monitorAffiliateActivity();
    assert.equal(
      (await query("SELECT state FROM affiliate_activity"))[0].state,
      "ACTIVE",
    );
    await query(
      "UPDATE affiliate_activity SET exempt=false,contract_reviewed=true",
    );
    await activity.monitorAffiliateActivity();
    assert.equal(
      (await query("SELECT state FROM affiliate_activity"))[0].state,
      "DORMANT",
    );
    assert.equal(
      (await query("SELECT status FROM affiliates"))[0].status,
      "active",
    );
    await query(
      "UPDATE affiliate_activity_settings SET automatic_suspension=true",
    );
    await activity.monitorAffiliateActivity();
    assert.equal(
      (await query("SELECT state FROM affiliate_activity"))[0].state,
      "DORMANT",
      "Suspension requires fourteen actual days in dormancy",
    );
    await query(
      "UPDATE affiliate_activity SET dormant_at=now()-interval '15 days'",
    );
    await activity.monitorAffiliateActivity();
    assert.equal(
      (await query("SELECT state FROM affiliate_activity"))[0].state,
      "SUSPENDED",
    );
    assert.equal((await query("SELECT count(*)::int n FROM users"))[0].n, 2);
    assert.equal(
      (await query("SELECT count(*)::int n FROM distribution_account_links"))[0]
        .n,
      1,
    );
    const notices = await query(
      "SELECT count(*)::int n FROM distribution_program_notices WHERE event_key LIKE 'activity-%'",
    );
    await activity.monitorAffiliateActivity();
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM distribution_program_notices WHERE event_key LIKE 'activity-%'",
        )
      )[0].n,
      notices[0].n,
    );
    const counts = await query(
      "SELECT kind,count(*)::int n FROM distribution_assets WHERE seed_key IS NOT NULL GROUP BY kind",
    );
    assert.deepEqual(Object.fromEntries(counts.map((r) => [r.kind, r.n])), {
      GRAPHIC: 6,
      SOCIAL: 10,
      DM: 5,
      EMAIL: 3,
      FOLLOW_UP: 3,
    });

    // Campaigns require opted-in recipients, exact confirmation and replay-safe enqueueing.
    await query("UPDATE affiliates SET status='active' WHERE id=$1", [session]);
    await query(
      "INSERT INTO email_preferences(email,marketing_opt_in) VALUES('invite@example.test',true) ON CONFLICT(email) DO UPDATE SET marketing_opt_in=true",
    );
    const comm = load("../src/lib/actions/affiliate-communication-actions.ts", {
      "@/lib/custom/service": { query },
      "@/lib/admin-session": deps["@/lib/admin-session"],
      "@/lib/support/service": deps["@/lib/support/service"],
      "next/cache": deps["next/cache"],
      "next/server": { after() {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => {},
      },
    });
    const campaignForm = new FormData();
    campaignForm.set("subject", "New approved JKTL materials");
    campaignForm.set(
      "body",
      "Explore the approved JKTL materials in your Affiliate workspace.",
    );
    campaignForm.set("audience", "ACTIVE");
    await comm.draftAffiliateCampaignAction(campaignForm);
    let campaign = (await query("SELECT * FROM affiliate_campaigns"))[0];
    assert.deepEqual(campaign.recipients, ["invite@example.test"]);
    const confirm = new FormData();
    confirm.set("id", campaign.id);
    confirm.set("count", "1");
    await assert.rejects(
      comm.confirmAffiliateCampaignAction(confirm),
      /Confirm/,
    );
    confirm.set("confirm", "on");
    await assert.rejects(
      comm.confirmAffiliateCampaignAction(confirm),
      /postal address/,
    );
    await query(
      `UPDATE email_branding SET settings=jsonb_set(settings,'{postalAddress}','"JKTL test address"'::jsonb)`,
    );
    await comm.confirmAffiliateCampaignAction(confirm);
    await assert.rejects(
      comm.confirmAffiliateCampaignAction(confirm),
      /Current draft/,
    );
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM distribution_program_notices WHERE event_key LIKE 'affiliate-campaign-%'",
        )
      )[0].n,
      1,
    );
    allowed = false;
    await assert.rejects(
      comm.draftAffiliateCampaignAction(campaignForm),
      /Denied/,
    );
    allowed = true;
    const secondAffiliate = (
      await query(
        "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,commission_model) VALUES('Another Affiliate','second-affiliate@example.test','unused','SECOND-CAMPAIGN','affiliate','active','policy') RETURNING id",
      )
    )[0].id;
    await query(
      "INSERT INTO email_preferences(email,marketing_opt_in) VALUES('second-affiliate@example.test',true)",
    );
    campaignForm.set("audience", "SELECTED");
    campaignForm.append("selected", session);
    campaignForm.append("selected", secondAffiliate);
    await comm.draftAffiliateCampaignAction(campaignForm);
    const selectedDraft = (
      await query(
        "SELECT recipients FROM affiliate_campaigns WHERE audience='SELECTED'",
      )
    )[0];
    assert.equal(selectedDraft.recipients.length, 2);
    // Checkout is authorized by the actual billing business and reuses one invoice.
    const organization = (
      await query(
        "INSERT INTO organizations(name,slug) VALUES('Billing business','reseller-completion') RETURNING id",
      )
    )[0].id;
    const partner = (
      await query(
        "INSERT INTO affiliates(name,email,password_hash,referral_code,programme,status,partner_terms_confirmed) VALUES('Agency','agency@example.test','unused','COMPLETION-AGENCY','partner','active',true) RETURNING id",
      )
    )[0].id;
    const partnerPolicy = (
      await query(
        "SELECT id FROM distribution_policies WHERE program='PARTNER' AND state='DRAFT' LIMIT 1",
      )
    )[0].id;
    const contract = (
      await query(
        "INSERT INTO distribution_contracts(affiliate_id,policy_id,terms,model,status,created_by) VALUES($1,$2,'{}','RESELLER','ACTIVE','owner') RETURNING id",
        [partner, partnerPolicy],
      )
    )[0].id;
    const clientInvite = (
      await query(
        "INSERT INTO partner_client_invitations(partner_id,token_hash,label) VALUES($1,'completion-client-invite','Client') RETURNING id",
        [partner],
      )
    )[0].id;
    const relationship = (
      await query(
        "INSERT INTO partner_client_access(partner_id,organization_id,invitation_id,granted_by) VALUES($1,$2,$3,$4) RETURNING id",
        [partner, organization, clientInvite, user],
      )
    )[0].id;
    const request = (
      await query(
        "INSERT INTO partner_service_requests(relationship_id,product,message) VALUES($1,'custom','A completed service request description') RETURNING id",
        [relationship],
      )
    )[0].id;
    const quote = (
      await query(
        "INSERT INTO partner_commercial_quotes(request_id,contract_id,amount_kobo,billing_party,scope,expires_at,created_by,status,accepted_by,billing_organization_id,accepted_at) VALUES($1,$2,100000,'CUSTOMER','Accepted service scope for testing',now()+interval '2 days','owner','ACCEPTED',$3,$4,now()) RETURNING id",
        [request, contract, user, organization],
      )
    )[0].id;
    let billingOrg = crypto.randomUUID(),
      checkoutCalls = 0;
    const program = load("../src/lib/actions/distribution-program-actions.ts", {
      "next/server": { after() {} },
      "@/lib/distribution/notifications": {
        flushProgramNotices: async () => {},
      },
      "@/lib/affiliate-commission": { DEFAULT_TERMS: {} },
      "node:crypto": crypto,
      "@/lib/session": {
        requireSession: async () => ({
          userId: user,
          organizationId: billingOrg,
        }),
      },
      "@/lib/custom/service": {
        query,
        owner: async () => ({ userId: user, organizationId: billingOrg }),
        initializeInvoice: async (id, org, uid) => {
          checkoutCalls++;
          assert.equal(org, organization);
          assert.equal(uid, user);
          await query(
            "UPDATE custom_invoices SET reference='reseller-exact-invoice' WHERE id=$1",
            [id],
          );
          return "https://checkout.paystack.com/mock-only";
        },
        verifyInvoice: async (ref) => {
          assert.equal(ref, "reseller-exact-invoice");
          await query(
            "UPDATE custom_invoices SET status='PAID',paid_at=now() WHERE reference=$1",
            [ref],
          );
        },
      },
      "@/lib/db/auth": { hashPassword: async () => "unused" },
      "@/lib/support/service": { rate: async () => {} },
      "@/lib/admin-session": deps["@/lib/admin-session"],
      "next/cache": deps["next/cache"],
      "next/navigation": deps["next/navigation"],
    });
    const pay = new FormData();
    pay.set("id", quote);
    await assert.rejects(program.payPartnerQuoteAction(pay), /billing owner/);
    assert.equal(
      (await query("SELECT count(*)::int n FROM custom_invoices"))[0].n,
      0,
    );
    billingOrg = organization;
    await assert.rejects(program.payPartnerQuoteAction(pay), /REDIRECT https:/);
    await assert.rejects(program.payPartnerQuoteAction(pay), /REDIRECT https:/);
    assert.equal(checkoutCalls, 2);
    assert.equal(
      (await query("SELECT count(*)::int n FROM custom_invoices"))[0].n,
      1,
    );
    assert.equal(
      (
        await query(
          "SELECT count(*)::int n FROM custom_projects WHERE billing_only=true",
        )
      )[0].n,
      1,
    );
    await assert.rejects(
      query(
        "UPDATE partner_commercial_quotes SET status='FULFILLED',payment_reference='reseller-exact-invoice' WHERE id=$1",
        [quote],
      ),
      /exact verified paid invoice/,
    );
    await program.verifyPartnerQuotePaymentAction(pay);
    await query(
      "UPDATE partner_commercial_quotes SET status='FULFILLED',payment_reference='reseller-exact-invoice' WHERE id=$1",
      [quote],
    );
    assert.equal(
      (
        await query(
          "SELECT status FROM partner_commercial_quotes WHERE id=$1",
          [quote],
        )
      )[0].status,
      "FULFILLED",
    );
    const oldPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      oldPriv = process.env.VAPID_PRIVATE_KEY;
    try {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "fixture";
      process.env.VAPID_PRIVATE_KEY = "fixture";
      const liveSession = (
        await query(
          "INSERT INTO affiliate_sessions(affiliate_id,expires_at) VALUES($1,now()+interval '1 day') RETURNING id",
          [session],
        )
      )[0].id;
      const expired = (
        await query(
          "INSERT INTO affiliate_sessions(affiliate_id,expires_at) VALUES($1,now()-interval '1 day') RETURNING id",
          [session],
        )
      )[0].id;
      for (const [endpoint, sid] of [
        ["https://fcm.googleapis.com/active", liveSession],
        ["https://fcm.googleapis.com/gone", liveSession],
        ["https://fcm.googleapis.com/expired", expired],
      ])
        await query(
          "INSERT INTO partner_push_subscriptions(endpoint,affiliate_id,session_id,p256dh,auth) VALUES($1,$2,$3,'fixture','fixture')",
          [endpoint, session, sid],
        );
      let transient = true;
      const payloads = [];
      const push = load("../src/lib/distribution/push.ts", {
        "server-only": {},
        "@/lib/custom/service": { query },
        "web-push": {
          default: {
            setVapidDetails() {},
            sendNotification: async (sub, payload) => {
              assert.ok(!sub.endpoint.endsWith("/expired"));
              if (sub.endpoint.endsWith("/gone")) throw { statusCode: 410 };
              if (transient) {
                transient = false;
                throw Error("transient push outage");
              }
              payloads.push(JSON.parse(payload));
            },
          },
        },
      });
      const emailsBefore = (
        await query(
          "SELECT count(*)::int n FROM distribution_program_notices WHERE delivered_at IS NOT NULL",
        )
      )[0].n;
      assert.equal((await push.flushProgrammePush()).failed, 1);
      await query(
        "UPDATE distribution_program_notices SET push_lease_until=now()-interval '1 minute' WHERE push_delivered_at IS NULL",
      );
      assert.equal((await push.flushProgrammePush()).failed, 0);
      assert.ok(payloads.length > 0);
      assert.ok(
        payloads.every(
          (p) =>
            p.body === "There is an update in your secure programme workspace.",
        ),
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM partner_push_subscriptions WHERE endpoint LIKE '%/gone'",
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM distribution_program_notices WHERE delivered_at IS NOT NULL",
          )
        )[0].n,
        emailsBefore,
      );
      const team = (
        await query(
          "INSERT INTO admin_users(name,email,password_hash,role,business_user_id) VALUES('Growth person','growth-person@example.test','unused','growth_gaming_lead',$1) RETURNING id",
          [user],
        )
      )[0].id;
      const businessSession = (
        await query(
          "INSERT INTO sessions(user_id,organization_id,expires_at) VALUES($1,$2,now()+interval '1 day') RETURNING id",
          [user, organization],
        )
      )[0].id;
      const ops = load("../src/lib/actions/partner-operations-actions.ts", {
        "next/headers": {
          cookies: async () => ({
            get: (name) =>
              name === "jktl_session" ? { value: businessSession } : undefined,
          }),
        },
        "@/lib/custom/service": { query },
        "@/lib/partners/access": {
          approvedProgramme: async () => ({ id: session }),
        },
        "@/lib/partners/support-access": {
          programmeSupportAgent: async () => ({
            id: team,
            role: "growth_gaming_lead",
            businessUserId: user,
          }),
        },
        "@/lib/admin-session": deps["@/lib/admin-session"],
        "@/lib/support/model": { pushSubscription },
        "@/lib/support/service": deps["@/lib/support/service"],
        "next/cache": deps["next/cache"],
      });
      const device = {
        endpoint: "https://fcm.googleapis.com/growth",
        p256dh: "a".repeat(87),
        auth: "b".repeat(22),
      };
      await ops.saveTeamProgrammePushAction(device);
      assert.equal(
        (
          await query(
            "SELECT business_session_id FROM support_push_subscriptions WHERE endpoint=$1",
            [device.endpoint],
          )
        )[0].business_session_id,
        businessSession,
      );
      await query(
        `UPDATE admin_users SET permission_overrides='{"growth_community":false}' WHERE id=$1`,
        [team],
      );
      await assert.rejects(
        ops.saveTeamProgrammePushAction(device),
        /Current linked/,
      );
      await query("DELETE FROM sessions WHERE id=$1", [businessSession]);
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM support_push_subscriptions WHERE endpoint=$1",
            [device.endpoint],
          )
        )[0].n,
        0,
        "Business logout revokes programme push binding",
      );
    } finally {
      if (oldPub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = oldPub;
      if (oldPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = oldPriv;
    }
  } finally {
    await db.close();
  }
});
