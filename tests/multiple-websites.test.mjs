import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { load } from "./fixtures/lifecycle-db.mjs";
import * as templates from "../src/lib/website-templates.ts";
import * as subdomains from "../src/lib/subdomain.ts";
import * as metrics from "../src/lib/site-metrics.ts";
const org = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  user = "cccccccc-cccc-cccc-cccc-cccccccccccc";
async function fixture() {
  const db = new PGlite(),
    q = async (s, p = []) => (await db.query(s, p)).rows;
  await db.exec(
    `CREATE TABLE organizations(id uuid PRIMARY KEY);INSERT INTO organizations VALUES('${org}'),('${other}');CREATE TABLE organization_members(organization_id uuid,user_id uuid,role text,active boolean);INSERT INTO organization_members VALUES('${org}','${user}','owner',true),('${other}','${user}','owner',true);CREATE TABLE business_profiles(id uuid DEFAULT gen_random_uuid(),organization_id uuid UNIQUE REFERENCES organizations(id),display_name text,subdomain text UNIQUE,published boolean,website_template_id text,website_document jsonb,website_revision int DEFAULT 0,custom_domain text DEFAULT '',custom_domain_verified boolean DEFAULT false,theme_color text);INSERT INTO business_profiles(organization_id,display_name,subdomain,published,website_template_id,website_document,custom_domain,custom_domain_verified) VALUES('${org}','Original','original',true,'law-firm','{}','original.example.com',true),('${other}','Other','other',false,'','{}','',false);CREATE TABLE custom_projects(id uuid,name text,website_url text,status text,organization_id uuid,billing_only boolean DEFAULT false,created_at timestamptz DEFAULT now());CREATE TABLE website_metric_events(organization_id uuid,event_id uuid,template_id text,page_kind text,event_type text,created_at timestamptz DEFAULT now(),UNIQUE(organization_id,event_id));CREATE TABLE website_plan_subscriptions(organization_id uuid,period_end timestamptz,plan_id text);CREATE TABLE services(organization_id uuid,active boolean,category text,name text);CREATE TABLE products(organization_id uuid,active boolean,category text,name text);CREATE TABLE testimonials(organization_id uuid,created_at timestamptz);`,
  );
  await db.exec(readFileSync("migrations/073_multiple_websites.sql", "utf8"));
  let session = { organizationId: org, userId: user };
  const model = load("src/lib/websites/model.ts", {
    "@/lib/subdomain": subdomains,
  });
  const base = async (id) => {
    const r = (
      await q("SELECT * FROM business_profiles WHERE organization_id=$1", [id])
    )[0];
    return {
      ...r,
      id: r.id,
      organizationId: id,
      displayName: r.display_name,
      subdomain: r.subdomain,
      published: r.published,
      websiteTemplateId: r.website_template_id,
      websiteRevision: r.website_revision,
      customDomain: r.custom_domain,
      customDomainVerified: r.custom_domain_verified,
    };
  };
  const service = load("src/lib/websites/service.ts", {
    "server-only": {},
    "@/lib/custom/service": { query: q },
    "@/lib/session": { requireSession: async () => session },
    "@/lib/db/organizations": { getBusinessProfile: base },
    "./model": model,
    "@/lib/website-templates": templates,
    "@/lib/subdomain": subdomains,
    "@/lib/security/auth-rate-limit": { authRateLimit: async () => {} },
  });
  const sql = (parts, ...p) =>
    q(
      parts.reduce((a, t, i) => a + (i ? "$" + i : "") + t, ""),
      p,
    );
  const pub = load("src/lib/db/public.ts", {
    "server-only": {},
    "./client": { getSql: () => sql },
    "./rows": {
      kobo: Number,
      isoDate: (s) => (s instanceof Date ? s.toISOString() : s),
    },
  });
  return {
    db,
    q,
    model,
    service,
    pub,
    switchOrg: (id) => (session.organizationId = id),
  };
}
test("additional sites retain independent documents, primary site and unique addresses", async () => {
  const f = await fixture();
  try {
    const id = await f.service.createWebsite({
      name: "Second website",
      subdomain: "second-site",
      templateId: "law-firm",
    });
    const second = await f.service.createWebsite({
      name: "Campaign",
      subdomain: "campaign-site",
      templateId: "blank-landing",
    });
    assert.notEqual(id, second);
    assert.equal((await f.service.websiteList()).sites.length, 3);
    await assert.rejects(
      () =>
        f.service.createWebsite({
          name: "Collision",
          subdomain: "original",
          templateId: "law-firm",
        }),
      (e) => e.code === "23505",
    );
    await assert.rejects(
      () =>
        f.q(
          "UPDATE business_profiles SET subdomain='second-site' WHERE organization_id=$1",
          [org],
        ),
      (e) => e.code === "23505",
    );
    assert.equal(
      (
        await f.q(
          "SELECT subdomain FROM business_profiles WHERE organization_id=$1",
          [org],
        )
      )[0].subdomain,
      "original",
    );
    const check = await f.service.addressCheck("second-site");
    assert.equal(check.available, false);
    assert.ok(check.suggestions.length);
    assert.ok(!check.suggestions.includes("original"));
    assert.equal(
      (await f.service.addressCheck("second-site", id)).available,
      true,
    );
    assert.equal(
      (await f.service.addressCheck("second-site", "primary")).available,
      false,
    );
    const doc = templates.templateDraft("law-firm", "Second website");
    doc.headline = "Independent content";
    await f.service.saveWebsite({
      id,
      templateId: "law-firm",
      document: doc,
      revision: 0,
      published: true,
    });
    assert.equal(
      (
        await f.q(
          "SELECT website_revision FROM business_profiles WHERE organization_id=$1",
          [org],
        )
      )[0].website_revision,
      0,
    );
    assert.equal((await f.service.loadWebsite(second)).published, false);
    await assert.rejects(
      () =>
        f.service.saveWebsite({
          id,
          templateId: "law-firm",
          document: doc,
          revision: 0,
          published: true,
        }),
      /changed in another session/,
    );
    await f.db.exec(
      readFileSync("migrations/073_multiple_websites.sql", "utf8"),
    );
    assert.equal((await f.service.loadWebsite(id)).revision, 1);
  } finally {
    await f.db.close();
  }
});
test("public routing hides drafts and uses each site content and canonical address", async () => {
  const f = await fixture();
  try {
    const id = await f.service.createWebsite({
      name: "Independent",
      subdomain: "independent",
      templateId: "law-firm",
    });
    assert.equal(await f.pub.getPublicSiteBySubdomain("independent"), null);
    await f.service.saveWebsite({
      id,
      templateId: "law-firm",
      document: templates.templateDraft("law-firm", "Independent"),
      revision: 0,
      published: true,
    });
    const site = await f.pub.getPublicSiteBySubdomain("independent");
    assert.equal(site.profile.subdomain, "independent");
    assert.equal(site.profile.customDomainVerified, false);
    assert.equal(site.profile.customDomain, "");
    assert.equal(site.profile.websiteDocument.brandName, "Independent");
    assert.equal(site.profile.organizationId, org);
    assert.equal(await f.pub.getOrganizationIdBySubdomain("independent"), org);
    assert.equal(
      (await f.pub.getPublicSiteBySubdomain("original")).profile.subdomain,
      "original",
    );
  } finally {
    await f.db.close();
  }
});
test("cross-organization and staff writes fail; metrics are isolated even with the same template", async () => {
  const f = await fixture();
  try {
    const id = await f.service.createWebsite({
      name: "Owned",
      subdomain: "owned-site",
      templateId: "law-firm",
    });
    f.switchOrg(other);
    assert.equal(await f.service.loadWebsite(id), null);
    await assert.rejects(
      () =>
        f.service.saveWebsite({
          id,
          templateId: "law-firm",
          document: templates.templateDraft("law-firm"),
          revision: 0,
          published: true,
        }),
      /changed/,
    );
    assert.equal((await f.service.websiteList()).sites.length, 0);
    f.switchOrg(org);
    await f.q(
      "UPDATE organization_members SET role='staff' WHERE organization_id=$1",
      [org],
    );
    await assert.rejects(
      () =>
        f.service.createWebsite({
          name: "No",
          subdomain: "not-allowed",
          templateId: "law-firm",
        }),
      /owner or manager/,
    );
    await metrics.recordSiteEvent(f.q, {
      organizationId: org,
      templateId: "law-firm",
      eventId: crypto.randomUUID(),
      event: "view",
      kind: "website",
      siteId: id,
      subdomain: "owned-site",
    });
    await metrics.recordSiteEvent(f.q, {
      organizationId: org,
      templateId: "law-firm",
      eventId: crypto.randomUUID(),
      event: "view",
      kind: "website",
      subdomain: "original",
    });
    assert.equal((await metrics.siteMetrics(f.q, org, id))[0].views, 1);
    assert.equal((await metrics.siteMetrics(f.q, org, "primary"))[0].views, 1);
    assert.equal((await metrics.siteMetrics(f.q, org))[0].views, 2);
  } finally {
    await f.db.close();
  }
});
