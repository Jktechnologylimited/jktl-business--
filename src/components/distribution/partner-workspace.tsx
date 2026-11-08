"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  Copy,
  ExternalLink,
  Monitor,
  Smartphone,
  Save,
  Upload,
  Search,
} from "lucide-react";
import { ClientServices } from "./client-services";
import {
  websiteTemplates,
  templateDraft,
  type WebsiteDocument,
} from "@/lib/website-templates";
import {
  partnerWorkspaceDataAction,
  savePartnerWebsiteAction,
  inviteWorkspaceOwnerAction,
  setPartnerChecklistAction,
} from "@/lib/actions/partner-workspace-actions";
import { WebsiteFields } from "@/components/support/website-fields";
import { WebsiteDraftPreview } from "@/components/support/website-draft-preview";
import { safeWebsiteUrl } from "@/lib/partners/workflow";
type Data = Awaited<ReturnType<typeof partnerWorkspaceDataAction>>;
export function PartnerWorkspace({
  clients,
  initialId,
}: {
  clients: { id: string; name: string; claimed: boolean }[];
  initialId?: string;
}) {
  const [id, setId] = useState(
      clients.some((c) => c.id === initialId)
        ? initialId!
        : clients[0]?.id || "",
    ),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [template, setTemplate] = useState(""),
    [doc, setDoc] = useState<WebsiteDocument | null>(null),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [url, setUrl] = useState(""),
    [tab, setTab] = useState("website"),
    [dirty, setDirty] = useState(false),
    [gallery, setGallery] = useState(false),
    [page, setPage] = useState(0),
    [preview, setPreview] = useState(false),
    [mobile, setMobile] = useState(false);
  function apply(r: Data) {
    setData(r);
    const tid = String(
      r.website?.website_template_id || r.workspace.template_id || "",
    );
    setTemplate(tid);
    setDoc(
      tid
        ? ((r.website?.website_template_id
            ? r.website.website_document
            : r.workspace.document) as WebsiteDocument)
        : null,
    );
    setRevision(Number(r.website?.website_revision ?? r.workspace.revision));
    setDirty(false);
    setGallery(!tid);
  }
  async function reload(preserveEdits = false) {
    const r = await partnerWorkspaceDataAction(id);
    if (preserveEdits && dirty) setData(r);
    else apply(r);
  }
  useEffect(() => {
    let active = true;
    if (id)
      void partnerWorkspaceDataAction(id)
        .then((r) => {
          if (active) apply(r);
        })
        .catch(() => {
          if (active)
            setError(
              "This workspace is unavailable. Check the owner’s permission or select another client.",
            );
        });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const filtered = websiteTemplates.filter(
      (t) =>
        (!category || t.category === category) &&
        (t.name + " " + t.category)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 9)),
    currentPage = Math.min(page, pages - 1),
    selected = websiteTemplates.find((t) => t.id === template);
  async function save(publish: boolean) {
    if (!doc || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await savePartnerWebsiteAction({
        id,
        templateId: template,
        document: doc,
        revision,
        publish,
      });
      if (!r.ok) setError(r.error || "Could not save.");
      else {
        setMessage(
          publish
            ? "Website published. Open the live site to check it."
            : "Website draft saved.",
        );
        await reload();
      }
    } catch {
      setError(
        "Could not confirm the save. Reload and check the latest version before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!clients.length)
    return (
      <section className="rounded-2xl border border-border bg-paper p-6">
        <h2 className="text-xl font-semibold">Start with a client.</h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Create the workspace above, then choose a design and prepare their
          website. You can invite the owner when the draft is ready.
        </p>
      </section>
    );
  const current = data && String(data.workspace.id) === id ? data : null,
    claimed = Boolean(current?.workspace.organization_id),
    scopes = current?.scopes || [],
    canEdit = !claimed || scopes.includes("MANAGE_WEBSITE_CONTENT"),
    canPublish = claimed && scopes.includes("PUBLISH_WEBSITE") && canEdit,
    live = safeWebsiteUrl(current?.website?.subdomain),
    enabled = Boolean(
      current?.registry.some(
        (r) =>
          r.slug === "website-builder" &&
          r.partner_mode === "SELF_SERVICE" &&
          (r.partner_actions as string[]).includes("CONFIGURE"),
      ),
    );
  const box = "rounded-2xl border border-border bg-paper p-5 sm:p-6",
    button =
      "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:opacity-50",
    secondary =
      "rounded-full border border-border bg-paper px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
  return (
    <div
      id="client-studio"
      className="space-y-5"
      style={{ overflowWrap: "anywhere" }}
    >
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="min-w-0 flex-1 text-sm font-semibold">
            Choose a client
            <select
              value={id}
              disabled={busy}
              onChange={(e) => {
                if (
                  dirty &&
                  !window.confirm(
                    "You have unsaved website changes. Switch clients and discard them?",
                  )
                )
                  return;
                setData(null);
                setDoc(null);
                setError("");
                setMessage("");
                setUrl("");
                setDirty(false);
                setPreview(false);
                setPage(0);
                setId(e.target.value);
              }}
              className="mt-2 block w-full max-w-lg rounded-xl border border-border bg-paper p-3 text-ink"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.claimed ? "" : " · Draft client"}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/partners/workspace?new=1#new-client"
            className="text-sm font-semibold text-blue-600 underline"
          >
            + New client
          </Link>
        </div>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-border bg-paper p-4 text-sm"
        >
          {message}
        </p>
      )}
      {!current && !error && (
        <p role="status" className="p-6 text-sm text-ink-muted">
          Loading the client workspace…
        </p>
      )}
      {current && (
        <>
          <section className={box}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  Client studio
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {String(current.workspace.business_name)}
                </h2>
                <p className="mt-3 text-sm text-ink-muted">
                  {claimed
                    ? "Owner connected · permissions checked for each action"
                    : "Draft client · owner approval needed before publishing"}
                </p>
              </div>
              {current.website?.published && live && (
                <a
                  href={live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  View live site
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
            <ol className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {[
                ["Client created", true],
                [
                  "Design saved",
                  Boolean(
                    current.website?.website_template_id ||
                    current.workspace.template_id,
                  ),
                ],
                ["Owner connected", claimed],
                ["Website published", Boolean(current.website?.published)],
              ].map(([label, done]) => (
                <li
                  key={String(label)}
                  className="flex items-center gap-2 rounded-lg bg-surface p-3"
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-on-primary" : "border border-border text-ink-muted"}`}
                  >
                    {done ? <Check size={13} /> : "○"}
                  </span>
                  {String(label)}
                </li>
              ))}
            </ol>
          </section>
          <nav
            aria-label="Client setup stages"
            className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-paper p-2 sm:grid-cols-4"
          >
            {[
              ["website", "Website studio"],
              ["owner", "Owner & access"],
              ["services", "Services & payments"],
              ["handover", "Client handover"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-current={tab === key ? "step" : undefined}
                onClick={() => setTab(key)}
                className={`rounded-xl px-3 py-3 text-sm font-semibold ${tab === key ? "bg-primary text-on-primary" : "text-ink-muted hover:bg-surface"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "website" && (
            <section id="website-builder" className={box}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Build their website</h3>
                  <p className="mt-2 text-sm leading-7 text-ink-muted">
                    Choose a design, make it theirs, then save and preview
                    before publishing.
                  </p>
                </div>
                {dirty && (
                  <span className="self-start rounded-full bg-accent-soft px-3 py-2 text-xs font-semibold">
                    Unsaved changes
                  </span>
                )}
              </div>
              {!enabled ? (
                <p className="mt-5 text-sm">
                  Website editing is currently unavailable for this programme.{" "}
                  <Link
                    href="/partners/support"
                    className="text-blue-600 underline"
                  >
                    Ask for support.
                  </Link>
                </p>
              ) : !canEdit ? (
                <div className="mt-5 rounded-xl bg-surface p-5">
                  <p className="text-sm leading-7">
                    The owner has not granted website editing access. Ask them
                    to review your permissions in Business → Programs & partner
                    access.
                  </p>
                  <button
                    onClick={() => setTab("owner")}
                    className={secondary + " mt-4"}
                  >
                    Review owner access
                  </button>
                </div>
              ) : (
                <>
                  {selected && (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-4">
                      <div>
                        <p className="text-xs text-ink-muted">
                          Selected template
                        </p>
                        <p className="mt-1 font-semibold">{selected.name}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setGallery(!gallery)}
                        className={secondary}
                      >
                        {gallery ? "Close template library" : "Change template"}
                      </button>
                    </div>
                  )}
                  {gallery && (
                    <div className="mt-6">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">
                          Search templates
                          <div className="relative mt-2">
                            <Search
                              size={17}
                              className="absolute left-3 top-3.5 text-ink-muted"
                            />
                            <input
                              value={search}
                              onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                              }}
                              placeholder="Try legal, retail or beauty"
                              className="w-full rounded-xl border border-border bg-paper py-3 pl-10 pr-3"
                            />
                          </div>
                        </label>
                        <label className="text-sm">
                          Industry
                          <select
                            value={category}
                            onChange={(e) => {
                              setCategory(e.target.value);
                              setPage(0);
                            }}
                            className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
                          >
                            <option value="">All industries</option>
                            {[
                              ...new Set(
                                websiteTemplates.map((t) => t.category),
                              ),
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className="my-4 text-xs text-ink-muted">
                        {filtered.length} designs · Website and landing-page
                        starting points
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered
                          .slice(currentPage * 9, currentPage * 9 + 9)
                          .map((t) => (
                            <article
                              key={t.id}
                              className="overflow-hidden rounded-xl border border-border"
                            >
                              <Image
                                unoptimized
                                src={`/template-previews/${t.id}.jpg`}
                                alt={`${t.name} preview`}
                                loading="lazy"
                                width={500}
                                height={338}
                                className="aspect-[1.5] w-full object-cover object-top"
                                onError={(e) => {
                                  if (!e.currentTarget.dataset.fallback) {
                                    e.currentTarget.dataset.fallback = "true";
                                    e.currentTarget.src = `/template-art/${t.sourceId || t.id}.svg`;
                                  }
                                }}
                              />
                              <div className="p-4">
                                <h4 className="text-sm font-semibold">
                                  {t.name}
                                </h4>
                                <p className="mt-1 text-xs text-ink-muted">
                                  {t.category}
                                </p>
                                <div className="mt-4 flex flex-wrap items-center gap-4">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        doc &&
                                        dirty &&
                                        !window.confirm(
                                          "Replace unsaved content with this template’s starting content?",
                                        )
                                      )
                                        return;
                                      setTemplate(t.id);
                                      setDoc(
                                        templateDraft(
                                          t.id,
                                          String(
                                            current.workspace.business_name,
                                          ),
                                        ),
                                      );
                                      setDirty(true);
                                      setGallery(false);
                                      setMessage("");
                                      setPreview(false);
                                    }}
                                    className="text-sm font-semibold text-primary"
                                  >
                                    Use template
                                  </button>
                                  <a
                                    href={"/templates/" + t.id}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 underline"
                                  >
                                    View ↗
                                  </a>
                                </div>
                              </div>
                            </article>
                          ))}
                      </div>
                      {!filtered.length && (
                        <p className="my-5 text-sm text-ink-muted">
                          No matching templates. Try a different industry or
                          search.
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                        <button
                          type="button"
                          disabled={currentPage === 0}
                          onClick={() => setPage(currentPage - 1)}
                          className={secondary}
                        >
                          Previous
                        </button>
                        <span>
                          {currentPage + 1} / {pages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= pages - 1}
                          onClick={() => setPage(currentPage + 1)}
                          className={secondary}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                  {doc && (
                    <div className="mt-7">
                      <fieldset disabled={busy}>
                        <legend className="sr-only">Website content</legend>
                        <WebsiteFields
                          value={doc}
                          onChange={(d) => {
                            setDoc(d);
                            setDirty(true);
                          }}
                          templateId={template}
                        />
                      </fieldset>
                      <div className="mt-6 rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <button
                            type="button"
                            aria-expanded={preview}
                            onClick={() => setPreview(!preview)}
                            className="text-sm font-semibold text-primary"
                          >
                            {preview ? "Close preview" : "Preview website"}
                          </button>
                          {preview && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                aria-label="Desktop preview"
                                aria-pressed={!mobile}
                                onClick={() => setMobile(false)}
                                className={secondary}
                              >
                                <Monitor size={17} />
                              </button>
                              <button
                                type="button"
                                aria-label="Mobile preview"
                                aria-pressed={mobile}
                                onClick={() => setMobile(true)}
                                className={secondary}
                              >
                                <Smartphone size={17} />
                              </button>
                            </div>
                          )}
                        </div>
                        {preview && (
                          <div
                            className="mx-auto max-w-full"
                            style={{ width: mobile ? 390 : "100%" }}
                          >
                            <WebsiteDraftPreview
                              templateId={template}
                              document={JSON.stringify(doc)}
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => save(false)}
                          className={button + " inline-flex items-center gap-2"}
                        >
                          <Save size={17} />
                          {busy ? "Working…" : "Save website"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canPublish}
                          onClick={() => save(true)}
                          className={
                            secondary + " inline-flex items-center gap-2"
                          }
                        >
                          <Upload size={17} />
                          {current.website?.published
                            ? "Publish updates"
                            : "Publish website"}
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-6 text-ink-muted">
                        {!claimed
                          ? "Save the draft, then invite the owner to connect their Business account before publishing."
                          : !canPublish
                            ? "The owner must grant Publish website permission before you can publish."
                            : "Publishing deploys the saved content to the client’s JKTL website. Paid upgrades do not require choosing a new template."}
                      </p>
                      {!canPublish && (
                        <button
                          type="button"
                          onClick={() => setTab("owner")}
                          className="mt-2 text-sm font-semibold text-blue-600 underline"
                        >
                          {claimed ? "Review permissions" : "Connect the owner"}{" "}
                          →
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {tab === "owner" && (
            <section className={box}>
              <h3 className="text-xl font-semibold">Owner & account access</h3>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                The business owner keeps their account. They sign in or create a
                Business account, then grant the permissions you need to finish
                the website.
              </p>
              <div className="mt-5 rounded-xl bg-surface p-4 text-sm">
                <p className="font-semibold">
                  {String(current.workspace.contact_name)}
                </p>
                <p className="mt-2 break-all text-ink-muted">
                  {String(current.workspace.contact_email)}
                </p>
              </div>
              {!claimed ? (
                <>
                  <ol className="my-5 list-decimal space-y-3 pl-5 text-sm leading-7">
                    <li>Create the private invitation link below.</li>
                    <li>
                      Share it with the intended owner using the contact email
                      shown.
                    </li>
                    <li>
                      The owner signs in, confirms the business and grants
                      editing/publishing permissions.
                    </li>
                    <li>Refresh this workspace and finish publishing.</li>
                  </ol>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        setUrl((await inviteWorkspaceOwnerAction(id)).url);
                      } catch {
                        setError(
                          "Could not prepare the invitation. Please retry.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={button}
                  >
                    Create owner invitation
                  </button>
                  {url && (
                    <div className="mt-5 space-y-3">
                      <label className="block text-sm">
                        Private owner invitation
                        <input
                          readOnly
                          value={url}
                          className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
                        />
                      </label>
                      <button
                        type="button"
                        className={
                          secondary + " inline-flex items-center gap-2"
                        }
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url);
                            setMessage(
                              "Invitation link copied. Share it privately with the owner.",
                            );
                          } catch {
                            setError(
                              "Select and copy the invitation link above.",
                            );
                          }
                        }}
                      >
                        <Copy size={16} />
                        Copy invitation link
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-5">
                  <p className="font-semibold">Owner connected</p>
                  <ul className="my-4 space-y-3 text-sm">
                    {[
                      ["MANAGE_WEBSITE_CONTENT", "Edit website"],
                      ["PUBLISH_WEBSITE", "Publish website"],
                      ["VIEW_ALLOWED_SERVICES", "View services"],
                      ["PURCHASE_DOMAINS", "Purchase domains"],
                    ].map(([scope, label]) => (
                      <li key={scope}>
                        {scopes.includes(scope) ? "✓ Granted" : "○ Not granted"}{" "}
                        · {label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm leading-7 text-ink-muted">
                    The owner can review or revoke these permissions in their
                    Business account. A Partner profile cannot grant itself
                    additional access.
                  </p>
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await reload(true);
                    setMessage("Client access refreshed.");
                  } catch {
                    setError("Could not refresh permissions.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className={secondary + " mt-5"}
              >
                Refresh owner status
              </button>
            </section>
          )}
          {tab === "services" && (
            <section className="space-y-5">
              <div className={box}>
                <h3 className="text-xl font-semibold">Services & payments</h3>
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Publish the free website first, then add the right services.
                  Confirm the client, permissions, price and billing party
                  before any checkout.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <Link
                    href="/partners/billing"
                    className="font-semibold text-blue-600 underline"
                  >
                    Review service quotes & payments →
                  </Link>
                  <Link
                    href="/partners/clients"
                    className="text-blue-600 underline"
                  >
                    Request email or another service →
                  </Link>
                </div>
              </div>
              {!claimed ? (
                <div className={box}>
                  <p className="text-sm leading-7">
                    Connect the owner before ordering services for their
                    Business account.
                  </p>
                  <button
                    onClick={() => setTab("owner")}
                    className={secondary + " mt-4"}
                  >
                    Invite the owner
                  </button>
                </div>
              ) : scopes.includes("VIEW_ALLOWED_SERVICES") ? (
                <ClientServices
                  key={id}
                  id={id}
                  canPurchaseDomains={[
                    "VIEW_ALLOWED_SERVICES",
                    "REQUEST_SERVICE_CHANGES",
                    "PURCHASE_DOMAINS",
                  ].every((scope) => scopes.includes(scope))}
                />
              ) : (
                <div className={box}>
                  <p className="text-sm leading-7">
                    The owner needs to grant View services permission before
                    these account details can be displayed.
                  </p>
                  <button
                    onClick={() => setTab("owner")}
                    className={secondary + " mt-4"}
                  >
                    Review permissions
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "handover" && (
            <section className={box}>
              <h3 className="text-xl font-semibold">
                A confident client handover
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                Review the live site together, check contact links and explain
                how the owner can sign in and request support. These checklist
                items record your work; they do not activate or pay for
                services.
              </p>
              <fieldset disabled={busy} className="mt-5 space-y-3">
                {[
                  [
                    "profile_review",
                    "Business details and contact information reviewed",
                  ],
                  [
                    "website_review",
                    "Website and mobile layout reviewed with client",
                  ],
                  ["training", "Client shown how to use their selected tools"],
                  [
                    "handover",
                    "Access, support and renewal responsibilities handed over",
                  ],
                ].map(([task, label]) => (
                  <label
                    key={task}
                    className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm leading-6"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        ((current.workspace.checklist as Record<
                          string,
                          unknown
                        >) || {})[task],
                      )}
                      onChange={async (e) => {
                        setBusy(true);
                        setError("");
                        try {
                          await setPartnerChecklistAction(
                            id,
                            task,
                            e.target.checked,
                          );
                          await reload(true);
                        } catch {
                          setError(
                            "Could not save the handover task. Check access and retry.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="mt-1"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <Link
                href="/help/partner-client-sites"
                className="mt-5 inline-block text-sm font-semibold text-blue-600 underline"
              >
                Read the client setup guide →
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
