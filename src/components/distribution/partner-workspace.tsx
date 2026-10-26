"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  websiteTemplates,
  templateDraft,
  type WebsiteDocument,
} from "@/lib/website-templates";
import {
  partnerWorkspaceDataAction,
  savePartnerWebsiteAction,
  inviteWorkspaceOwnerAction,
} from "@/lib/actions/partner-workspace-actions";
import { WebsiteFields } from "@/components/support/website-fields";
import { WebsiteDraftPreview } from "@/components/support/website-draft-preview";
export function PartnerWorkspace({
  clients,
  initialId,
}: {
  clients: { id: string; name: string; claimed: boolean }[];
  initialId?: string;
}) {
  const [id, setId] = useState(initialId || clients[0]?.id || ""),
    [data, setData] = useState<Awaited<
      ReturnType<typeof partnerWorkspaceDataAction>
    > | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [template, setTemplate] = useState(""),
    [doc, setDoc] = useState<WebsiteDocument | null>(null),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [url, setUrl] = useState("");
  async function load(key: string) {
    const r = await partnerWorkspaceDataAction(key);
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
  }
  useEffect(() => {
    let active = true;
    if (id)
      void partnerWorkspaceDataAction(id)
        .then((r) => {
          if (!active) return;
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
          setRevision(
            Number(r.website?.website_revision ?? r.workspace.revision),
          );
        })
        .catch(() => {
          if (active)
            setError(
              "Workspace unavailable. Check client permissions or choose another client.",
            );
        });
    return () => {
      active = false;
    };
  }, [id]);
  if (!clients.length) return <p>Create your first client draft to begin.</p>;
  const filtered = websiteTemplates.filter(
    (t) =>
      (!category || t.category === category) &&
      (t.name + " " + t.category).toLowerCase().includes(search.toLowerCase()),
  );
  async function save(publish: boolean) {
    if (!doc) return;
    setBusy(true);
    setError("");
    try {
      const r = await savePartnerWebsiteAction({
        id,
        templateId: template,
        document: doc,
        revision,
        publish,
      });
      if (!r.ok) setError(r.error || "Save failed");
      else {
        setMessage(publish ? "Website published." : "Draft saved.");
        await load(id);
      }
    } catch {
      setError("Unable to save. Reload and check access before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <label className="block font-semibold">
        Selected client
        <select
          value={id}
          disabled={busy}
          onChange={(e) => {
            setData(null);
            setDoc(null);
            setError("");
            setMessage("");
            setUrl("");
            setId(e.target.value);
          }}
          className="ml-3 rounded-lg border border-border bg-paper p-3"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.claimed ? "" : " · Draft"}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data && String(data.workspace.id) === id && (
        <>
          <section className="rounded-xl border border-border p-5">
            <h2 className="text-xl font-semibold">
              {String(data.workspace.business_name)}
            </h2>
            <p className="my-3">
              {data.workspace.organization_id
                ? "Client relationship accepted"
                : "Draft workspace — client has not accepted yet"}
            </p>
            <p>{String(data.workspace.requirements)}</p>
            <div className="my-3 grid gap-2 text-sm">
              <p>✓ Workspace created</p>
              <p>
                {data.workspace.organization_id ? "✓" : "○"} Owner invitation
                accepted
              </p>
              <p>{template ? "✓" : "○"} Template selected</p>
              <p>{doc ? "✓" : "○"} Website content prepared</p>
              <p>{data.website?.published ? "✓" : "○"} Website published</p>
            </div>
            {!data.workspace.organization_id && (
              <button
                disabled={busy}
                className="rounded-lg border border-border p-3"
                onClick={async () => {
                  try {
                    setBusy(true);
                    setUrl((await inviteWorkspaceOwnerAction(id)).url);
                  } catch {
                    setError("Could not create invitation");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Invite owner to claim
              </button>
            )}
            {url && (
              <label className="mt-3 block">
                Share this private, one-use link with the owner
                <input
                  readOnly
                  value={url}
                  className="mt-2 w-full rounded border border-border bg-paper p-3"
                />
              </label>
            )}
          </section>
          <section className="rounded-xl border border-border p-5">
            <h2 className="text-xl font-semibold">JKTL services</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.registry.map((r) => (
                <article
                  key={String(r.slug)}
                  className="rounded-lg border border-border p-4"
                >
                  <strong>{String(r.name)}</strong>
                  <p className="my-2 text-sm">{String(r.partner_mode)}</p>
                  {r.slug === "website-builder" || r.slug === "templates" ? (
                    <a href="#website-builder" className="underline">
                      Set up website
                    </a>
                  ) : (
                    <Link href="/partners/clients" className="underline">
                      Request authorized setup
                    </Link>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm">
              Domains, email and other assisted products use JKTL’s existing
              fulfillment teams. Request review before any order or payment;
              only the client or authorized billing party can approve purchases.
            </p>
          </section>
          {data.registry.some(
            (r) =>
              r.slug === "website-builder" &&
              (r.partner_actions as string[]).includes("CONFIGURE"),
          ) &&
            (!data.workspace.organization_id || data.website) && (
              <section
                id="website-builder"
                className="rounded-xl border border-border p-5"
              >
                <h2 className="text-xl font-semibold">Website setup</h2>
                <div className="my-4 flex flex-wrap gap-3">
                  <input
                    aria-label="Search templates"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates"
                    className="rounded border border-border bg-paper p-3"
                  />
                  <select
                    aria-label="Template category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded border border-border bg-paper p-3"
                  >
                    <option value="">All industries</option>
                    {[...new Set(websiteTemplates.map((t) => t.category))].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </div>
                <label>
                  Template
                  <select
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      setDoc(
                        templateDraft(
                          e.target.value,
                          String(data.workspace.business_name),
                        ),
                      );
                    }}
                    className="my-3 block w-full rounded border border-border bg-paper p-3"
                  >
                    <option value="" disabled>
                      Choose a template
                    </option>
                    {filtered.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.category}
                      </option>
                    ))}
                  </select>
                </label>
                {doc && (
                  <>
                    <WebsiteDraftPreview
                      templateId={template}
                      document={JSON.stringify(doc)}
                    />
                    <WebsiteFields value={doc} onChange={setDoc} />
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        disabled={busy}
                        onClick={() => save(false)}
                        className="rounded-lg bg-primary p-3 text-on-primary"
                      >
                        {busy ? "Saving…" : "Save website"}
                      </button>
                      {data.workspace.organization_id && (
                        <button
                          disabled={busy}
                          onClick={() => save(true)}
                          className="rounded-lg border border-border p-3"
                        >
                          Publish with client permission
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
        </>
      )}
    </div>
  );
}
