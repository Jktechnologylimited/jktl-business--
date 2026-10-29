"use client";
import { ManagedCmsConfig } from "./managed-config";
import { useState } from "react";
import * as actions from "@/lib/actions/custom-project-actions";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
type Data = {
  clients: Row[];
  projects: Row[];
  services: Row[];
  invoices: Row[];
  requests: Row[];
  audit: Row[];
  invitations?: Row[];
};
const val = (d: FormData, k: string) => String(d.get(k) || "");
export function CustomAdmin({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState("Clients"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState("");
  async function run(
    task: () => Promise<{
      ok: boolean;
      error?: string;
      data?: { key: string };
    }>,
  ) {
    setBusy(true);
    setMessage("");
    setSecret("");
    try {
      const r = await task();
      if (!r.ok) setMessage(r.error || "Please retry.");
      else {
        setMessage("Saved.");
        if (r.data) setSecret(r.data.key);
        const next = await actions.customAdminAction();
        if (next.ok) setData(next.data);
      }
    } catch {
      setMessage(
        "Could not save. Reload and check the record before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>JKTL TEAM / CUSTOM PROJECTS</p>
        <h1>
          Independent sites.
          <br />
          One client workspace.
        </h1>
        <p>
          Configure projects and services, test a pilot, then invite the
          customer. No production database URLs belong here.
        </p>
      </header>
      <div className={styles.body}>
        <nav className={styles.links}>
          {[
            "Clients",
            "Projects",
            "Services",
            "Invoices",
            "Support",
            "Audit",
          ].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {secret && (
          <div className={styles.section}>
            <h2>Integration key — shown once</h2>
            <p>
              Copy into this website’s server environment as
              JKTL_CUSTOM_API_KEY. Never add it to NEXT_PUBLIC variables.
              Rotating the key disables CMS launch until the pilot is confirmed
              again.
            </p>
            <code className="my-4 block break-all select-all">{secret}</code>
            <button onClick={() => setSecret("")}>Dismiss</button>
          </div>
        )}
        {tab === "Clients" && (
          <>
            <section className={styles.section}>
              <h2>Configure a client account</h2>
              <p>
                New clients receive an unusable random password until
                activation. Existing account owners retain their account and
                password. Creating a record does not send email.
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.createCustomClientAction({
                      name: val(d, "name"),
                      email: val(d, "email"),
                      organizationId: val(d, "org") || undefined,
                    }),
                  );
                }}
              >
                <label>
                  Business / client name
                  <input name="name" required maxLength={200} />
                </label>
                <label>
                  Owner email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Existing organization ID (optional)
                  <input name="org" />
                </label>
                <button disabled={busy}>Create client workspace</button>
              </form>
            </section>
            {data.clients.map((c) => (
              <section
                className={styles.section}
                key={String(c.organization_id)}
              >
                <h2>{String(c.name)}</h2>
                <p>
                  {String(c.email)} ·{" "}
                  {c.activated_at ? "Account active" : "Activation pending"}
                </p>
                <p className="my-3 break-all text-xs">
                  Organization: {String(c.organization_id)}
                </p>
                <p>
                  {
                    data.projects.filter(
                      (p) => p.organization_id === c.organization_id,
                    ).length
                  }{" "}
                  projects · {c.pilot_ready ? "Pilot ready" : "Pilot pending"}
                </p>
                <ul className="my-3 text-sm">
                  {(data.invitations || [])
                    .filter((i) => i.organization_id === c.organization_id)
                    .slice(0, 3)
                    .map((i) => (
                      <li key={String(i.id)}>
                        Invitation:{" "}
                        {i.accepted_at
                          ? "Accepted"
                          : i.revoked_at
                            ? "Revoked / superseded"
                            : i.used_at
                              ? "Previously used"
                              : new Date(String(i.expires_at)) < new Date()
                                ? "Expired"
                                : i.sent_at
                                  ? "Sent — awaiting acceptance"
                                  : "Not submitted"}{" "}
                        · expires{" "}
                        {new Date(String(i.expires_at)).toLocaleString(
                          "en-NG",
                          { timeZone: "Africa/Lagos" },
                        )}{" "}
                        WAT
                      </li>
                    ))}
                </ul>
                <div className={styles.links}>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        actions.setCustomReadyAction(
                          String(c.organization_id),
                          !c.pilot_ready,
                        ),
                      )
                    }
                  >
                    {c.pilot_ready
                      ? "Disable readiness"
                      : "Confirm configured pilot ready"}
                  </button>
                  <button
                    disabled={busy || !c.pilot_ready}
                    onClick={() =>
                      run(() =>
                        actions.sendCustomInviteAction(
                          String(c.organization_id),
                        ),
                      )
                    }
                  >
                    Send individual invitation
                  </button>
                </div>
              </section>
            ))}
          </>
        )}
        {tab === "Projects" && (
          <>
            <ProjectForm clients={data.clients} busy={busy} save={run} />
            {data.projects.map((p) => (
              <section key={String(p.id)} className={styles.section}>
                <ProjectForm
                  project={p}
                  clients={data.clients}
                  busy={busy}
                  save={run}
                />
                <p className="my-3 break-all text-xs">
                  Integration project ID: {String(p.id)}
                </p>
                <ManagedCmsConfig projectId={String(p.id)} />
                <p>
                  CMS:{" "}
                  {p.managed_cms
                    ? "Business editor"
                    : p.cms_tested_at
                      ? "Pilot confirmed"
                      : "Not enabled"}
                </p>
                {!p.managed_cms && (
                  <div className={styles.links}>
                    <button
                      disabled={busy || !p.cms_url}
                      onClick={() =>
                        run(() =>
                          actions.configureCustomCmsAction(String(p.id), false),
                        )
                      }
                    >
                      Generate / rotate integration key
                    </button>
                    <button
                      disabled={busy || !p.cms_url}
                      onClick={() =>
                        run(() =>
                          actions.configureCustomCmsAction(String(p.id), true),
                        )
                      }
                    >
                      Confirm CMS pilot tested
                    </button>
                  </div>
                )}
              </section>
            ))}
          </>
        )}
        {tab === "Services" && (
          <>
            <section className={styles.section}>
              <h2>Propose a service agreement</h2>
              <p>
                Use the client’s agreed prices, never illustrative defaults.
                Existing accepted pricing is immutable: pause the old service
                and propose a replacement for customer approval. Domain renewal
                stays in My Domains.
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.saveCustomServiceAction({
                      projectId: val(d, "project"),
                      name: val(d, "name"),
                      category: val(d, "category"),
                      description: val(d, "description"),
                      amountKobo: Number(d.get("amount")),
                      discountKobo: Number(d.get("discount")),
                      interval: val(d, "interval"),
                      startsOn: val(d, "start"),
                    }),
                  );
                }}
              >
                <label>
                  Project
                  <select name="project" required>
                    {data.projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Service name
                  <input name="name" required />
                </label>
                <label>
                  Category
                  <select name="category">
                    {[
                      "HOSTING",
                      "MAINTENANCE",
                      "EMAIL",
                      "DEVELOPMENT",
                      "OTHER",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Scope / infrastructure fee explanation
                  <textarea name="description" required maxLength={2000} />
                </label>
                <label>
                  Full price (kobo)
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    max="2000000000"
                    step="1"
                    required
                  />
                </label>
                <label>
                  Discount per invoice (kobo)
                  <input
                    name="discount"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Interval
                  <select name="interval">
                    {["MONTHLY", "ANNUAL", "ONCE"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Start date
                  <input name="start" type="date" required />
                </label>
                <button disabled={busy || !data.projects.length}>
                  Propose for customer approval
                </button>
              </form>
            </section>
            {data.services.map((s) => (
              <section key={String(s.id)} className={styles.section}>
                <h3>{String(s.name)}</h3>
                <p>{String(s.description)}</p>
                <p>
                  ₦
                  {(
                    (Number(s.amount_kobo) - Number(s.discount_kobo)) /
                    100
                  ).toLocaleString()}{" "}
                  / {String(s.interval)} · {String(s.status)} · automatic debit
                  disabled
                </p>
                <div className={styles.links}>
                  {["PAUSED", "CANCELLED"].map((status) => (
                    <button
                      disabled={busy || s.status === "CANCELLED"}
                      key={status}
                      onClick={() =>
                        run(() =>
                          actions.changeCustomServiceAction(
                            String(s.id),
                            status,
                          ),
                        )
                      }
                    >
                      {status === "PAUSED" ? "Pause" : "Cancel"} future invoices
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
        {tab === "Invoices" && (
          <section className={styles.section}>
            <h2>Custom invoices</h2>
            <p>
              Verified Paystack payments only. No manual “mark paid” control.
              Open invoices remain payable after a service is paused; review
              them separately before cancelling the service.
            </p>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Due</th>
                    <th>NGN</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={String(i.id)}>
                      <td>{String(i.description)}</td>
                      <td>{String(i.due_on).slice(0, 10)}</td>
                      <td>{(Number(i.amount_kobo) / 100).toLocaleString()}</td>
                      <td>{String(i.status)}</td>
                      <td className="break-all">
                        {String(i.reference || "Not initialized")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === "Support" &&
          data.requests.map((r) => (
            <section key={String(r.id)} className={styles.section}>
              <h3>
                {String(r.kind)} · {String(r.status)}
              </h3>
              <p>
                {
                  data.projects.find((p) => p.id === r.project_id)
                    ?.name as string
                }
              </p>
              <p className="my-4 whitespace-pre-wrap">{String(r.message)}</p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.replyCustomRequestAction(
                      String(r.id),
                      val(d, "status"),
                      val(d, "reply"),
                    ),
                  );
                }}
              >
                <label>
                  Status
                  <select name="status">
                    {["PROCESSING", "COMPLETED", "DECLINED"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Customer-visible response
                  <textarea
                    name="reply"
                    defaultValue={String(r.reply)}
                    required
                  />
                </label>
                <button disabled={busy}>Update request</button>
              </form>
            </section>
          ))}
        {tab === "Audit" && (
          <section className={styles.section}>
            <h2>Recent activity</h2>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Actor</th>
                    <th>Time</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.map((a) => (
                    <tr key={String(a.id)}>
                      <td>{String(a.event)}</td>
                      <td>{String(a.actor_id)}</td>
                      <td>{String(a.created_at)}</td>
                      <td>{JSON.stringify(a.detail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
function ProjectForm({
  project: p,
  clients,
  busy,
  save,
}: {
  project?: Row;
  clients: Row[];
  busy: boolean;
  save: (task: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        save(() =>
          actions.saveCustomProjectAction({
            id: p ? String(p.id) : undefined,
            organizationId: val(d, "org"),
            name: val(d, "name"),
            websiteUrl: val(d, "website"),
            cmsUrl: val(d, "cms"),
            analyticsUrl: val(d, "analytics"),
            description: val(d, "description"),
            status: val(d, "status"),
            revision: p ? Number(p.revision) : undefined,
            domainAssetId: val(d, "domain") || undefined,
            deploymentProvider: val(d, "deployment"),
            vercelProjectRef: val(d, "vercel"),
            githubRepositoryRef: val(d, "github"),
            internalNotes: val(d, "internal"),
            maintenanceAgreement: val(d, "maintenance"),
            emailServiceId: val(d, "emailService"),
            cmsFields: val(d, "fields")
              .split(/[,\n]/)
              .map((v) => v.trim())
              .filter(Boolean),
            cmsScopes: d.getAll("scope").map(String),
          }),
        );
      }}
    >
      <h2>{p ? String(p.name) : "Attach a custom project"}</h2>
      <label>
        Client
        <select
          name="org"
          defaultValue={String(p?.organization_id || "")}
          required
        >
          {clients.map((c) => (
            <option
              key={String(c.organization_id)}
              value={String(c.organization_id)}
            >
              {String(c.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Project name
        <input name="name" defaultValue={String(p?.name || "")} required />
      </label>
      <label>
        Live website URL
        <input
          name="website"
          type="url"
          defaultValue={String(p?.website_url || "")}
          placeholder="https://"
          required
        />
      </label>
      <label>
        Status
        <select name="status" defaultValue={String(p?.status || "CONFIGURING")}>
          {["CONFIGURING", "LIVE", "PAUSED", "ARCHIVED"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Customer-visible project scope
        <textarea
          name="description"
          defaultValue={String(p?.description || "")}
          required
        />
      </label>
      <label>
        CMS callback URL (optional)
        <input
          name="cms"
          type="url"
          defaultValue={String(p?.cms_url || "")}
          placeholder="https://client.example/api/jktl/callback"
        />
      </label>
      <label>
        Protected analytics URL (optional)
        <input
          name="analytics"
          type="url"
          defaultValue={String(p?.analytics_url || "")}
        />
      </label>
      <label>
        Customer-owned domain asset ID (optional)
        <input name="domain" defaultValue={String(p?.domain_asset_id || "")} />
      </label>
      <fieldset className="space-y-4 border-t border-border pt-4">
        <legend>Deployment & service links</legend>
        <label>
          Deployment provider
          <input
            name="deployment"
            defaultValue={String(p?.deployment_provider || "")}
            maxLength={100}
          />
        </label>
        <label>
          Vercel project reference — team only
          <input
            name="vercel"
            defaultValue={String(p?.vercel_project_ref || "")}
            maxLength={200}
          />
        </label>
        <label>
          GitHub owner/repository — team only
          <input
            name="github"
            defaultValue={String(p?.github_repository_ref || "")}
            maxLength={250}
          />
        </label>
        <label>
          Linked business email service ID
          <input
            name="emailService"
            defaultValue={String(p?.email_service_id || "")}
          />
        </label>
        <label>
          Maintenance agreement — client visible
          <textarea
            name="maintenance"
            defaultValue={String(p?.maintenance_agreement || "")}
            maxLength={2000}
          />
        </label>
        <label>
          Internal project notes — team only
          <textarea
            name="internal"
            defaultValue={String(p?.internal_notes || "")}
            maxLength={4000}
          />
        </label>
        <p className="text-xs">
          Link hosting and maintenance charges in Services. Never paste
          credentials into these records. The project UUID stays the same across
          deployments.
        </p>
      </fieldset>
      <fieldset className="space-y-3 border-t border-border pt-4">
        <legend>Verified CMS capabilities</legend>
        <label>
          Supported field identifiers — one per line
          <textarea
            name="fields"
            defaultValue={
              Array.isArray(p?.cms_fields) ? p.cms_fields.join("\n") : ""
            }
          />
        </label>
        {[
          ["content:read", "Read content"],
          ["content:write", "Edit content"],
          ["content:publish", "Publish content"],
        ].map(([scope, label]) => (
          <label key={scope}>
            <input
              type="checkbox"
              name="scope"
              value={scope}
              defaultChecked={
                Array.isArray(p?.cms_scopes)
                  ? p.cms_scopes.includes(scope)
                  : scope === "content:read"
              }
            />
            {label}
          </label>
        ))}
        <p className="text-xs">
          Enable only fields and permissions implemented and tested in this
          project’s CMS adapter. An attached URL alone does not enable editing.
        </p>
      </fieldset>
      <button disabled={busy || !clients.length}>
        {p ? "Save project" : "Add project"}
      </button>
    </form>
  );
}
