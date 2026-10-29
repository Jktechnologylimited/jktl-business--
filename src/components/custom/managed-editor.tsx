"use client";
import { useMemo, useState } from "react";
import {
  saveManagedSiteAction,
  uploadManagedImageAction,
} from "@/lib/actions/managed-site-actions";
import type { SiteManifest } from "@/lib/custom/site-schema";
export function ManagedSiteEditor({
  projectId,
  manifest,
  websiteUrl,
  draft,
  revision: initial,
  scope,
}: {
  projectId: string;
  manifest: SiteManifest;
  websiteUrl: string;
  draft: Record<string, string>;
  revision: number;
  scope: readonly string[];
}) {
  const entries = useMemo(() => Object.entries(manifest), [manifest]);
  const groups = useMemo(
    () => [...new Set(entries.map(([, f]) => f.group))],
    [entries],
  );
  const [values, setValues] = useState(draft),
    [revision, setRevision] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [group, setGroup] = useState(Object.values(manifest)[0]?.group || ""),
    [search, setSearch] = useState(""),
    [dirty, setDirty] = useState(false);
  const visible = useMemo(
    () =>
      entries.filter(
        ([id, f]) =>
          (!group || f.group === group) &&
          (!search ||
            (f.label + " " + values[id] + " " + f.group)
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [values, group, search, entries],
  );
  const writable = scope.includes("content:write");
  async function save(publish: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const r = await saveManagedSiteAction(
        projectId,
        values,
        revision,
        publish,
      );
      if (r.ok) {
        setRevision(r.revision);
        setDirty(false);
        setMessage(
          publish
            ? "Published across the website. Open the relevant page to check your changes."
            : "Draft saved. Public pages keep their previously published content.",
        );
      } else setMessage(r.error);
    } catch {
      setMessage("Connection interrupted. Reload before retrying.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(id: string, file: File) {
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData();
      data.set("image", file);
      const result = await uploadManagedImageAction(projectId, data);
      if (!result.ok || typeof result.url !== "string") throw Error();
      setValues((v) => ({ ...v, [id]: result.url }));
      setDirty(true);
      setMessage(
        "Image uploaded and added to your draft. Save or publish to use it.",
      );
    } catch {
      setMessage(
        "Upload failed. Use a PNG, JPEG or WebP image smaller than 3 MB and reopen the editor if your session expired.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-8">
      <p className="my-4 text-sm">
        Edit all public pages, service areas, attorney profiles, images,
        testimonials, navigation, contact details, office hours and page SEO.
        Source code, private records, mail credentials and deployment settings
        remain protected.
      </p>
      <div className="grid gap-4 rounded border border-slate-300 bg-slate-50 p-4 md:grid-cols-2">
        <label>
          Website section
          <select
            className="mt-2 block w-full border bg-white p-3 text-slate-950"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">All sections</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label>
          Search content
          <input
            type="search"
            className="mt-2 block w-full border bg-white p-3 text-slate-950"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a service, attorney, heading or image"
          />
        </label>
      </div>
      <p className="my-3 text-sm">
        {visible.length} fields in this view · Revision {revision}
        {dirty ? " · Unsaved changes" : ""}
      </p>
      {message && (
        <p role="status" className="my-4 border border-slate-300 p-4">
          {message}
        </p>
      )}
      <div className="sticky top-24 z-20 my-5 flex flex-wrap gap-3 border border-slate-300 bg-white p-3 shadow-sm">
        <button
          type="button"
          disabled={busy || !writable}
          onClick={() => void save(false)}
          className="rounded bg-slate-800 px-5 py-3 text-white disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={busy || !writable || !scope.includes("content:publish")}
          onClick={() => void save(true)}
          className="rounded bg-[#b58c32] px-5 py-3 text-white disabled:opacity-50"
        >
          Publish to website
        </button>
      </div>
      {visible.map(([id, f]) => (
        <div key={id} className="my-5 rounded border border-slate-200 p-4">
          <label
            htmlFor={"field-" + id}
            className="block text-sm font-semibold"
          >
            {f.label}
          </label>
          <p className="my-1 text-xs text-slate-600">
            {f.group} · {f.kind}
          </p>
          {f.kind === "image" && (
            <img
              src={
                values[id].startsWith("/")
                  ? new URL(values[id], websiteUrl).toString()
                  : values[id]
              }
              alt="Current website image"
              className="my-3 max-h-48 max-w-full rounded object-contain"
            />
          )}
          <textarea
            id={"field-" + id}
            rows={
              f.kind === "image" || f.kind === "link"
                ? 2
                : Math.min(12, Math.max(2, Math.ceil(values[id].length / 100)))
            }
            className="mt-2 block w-full rounded border border-slate-400 bg-white p-3 text-slate-950"
            value={values[id]}
            maxLength={f.max}
            disabled={busy || !writable}
            onChange={(e) => {
              setValues({ ...values, [id]: e.target.value });
              setDirty(true);
            }}
          />
          {f.kind === "image" && (
            <label className="mt-3 block text-sm">
              Upload replacement image (PNG, JPEG or WebP, up to 3 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy || !writable}
                className="mt-2 block max-w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(id, file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {f.kind === "image" && (
            <p className="mt-2 text-xs text-slate-600">
              Use an existing local image path, upload a photo, or use an
              images.unsplash.com HTTPS URL.
            </p>
          )}
          <button
            type="button"
            disabled={busy || !writable}
            className="mt-3 text-xs underline"
            onClick={() => {
              if (
                window.confirm(
                  "Restore this field to the original website content in your draft?",
                )
              ) {
                setValues({ ...values, [id]: f.default });
                setDirty(true);
              }
            }}
          >
            Restore original field
          </button>
        </div>
      ))}
      {!visible.length && (
        <p>No fields match. Choose another section or clear the search.</p>
      )}
    </section>
  );
}
