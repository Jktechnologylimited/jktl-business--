"use client";
import { useState } from "react";
import {
  managedCmsConfigAction,
  saveManagedCmsConfigAction,
} from "@/lib/actions/managed-site-actions";
export function ManagedCmsConfig({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<{
      revision: number;
      enabled: boolean;
      manifest: unknown;
      scopes: string[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    try {
      const r = await managedCmsConfigAction(projectId);
      if (r.ok)
        setConfig({
          revision: Number(r.data.revision),
          enabled: Boolean(r.data.managed_cms),
          manifest: r.data.cms_manifest,
          scopes: r.data.cms_scopes as string[],
        });
      else setMessage(r.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-5 rounded border border-current/20 p-4">
      <h3 className="font-semibold">Editor inside JKTL Business</h3>
      <p className="my-2 text-sm">
        Uses the existing Business login and database. No website API key or
        extra private environment variables.
      </p>
      {!config ? (
        <button
          disabled={busy}
          type="button"
          className="underline"
          onClick={() => void load()}
        >
          Configure Business editor
        </button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const r = await saveManagedCmsConfigAction(
                projectId,
                config.revision,
                config.enabled,
                config.manifest,
                config.scopes,
              );
              if (r.ok) {
                setMessage(
                  "Saved. Client editing still requires an activated owner account.",
                );
                await load();
              } else setMessage(r.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />{" "}
            Enable Business editor
          </label>
          <label className="block">
            Import website content manifest (.json)
            <input
              type="file"
              accept="application/json,.json"
              className="my-2 block max-w-full"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 450000) {
                  setMessage("Manifest is too large.");
                  return;
                }
                try {
                  setConfig({
                    ...config,
                    manifest: JSON.parse(await file.text()),
                  });
                  setMessage("Manifest loaded. Save to apply it.");
                } catch {
                  setMessage("Choose a valid JSON manifest.");
                }
              }}
            />
          </label>
          <p className="text-xs">
            {config.manifest && typeof config.manifest === "object"
              ? Object.keys(config.manifest).length
              : 0}{" "}
            declared fields
          </p>
          {["content:read", "content:write", "content:publish"].map((scope) => (
            <label className="mr-4 inline-flex gap-2" key={scope}>
              <input
                type="checkbox"
                checked={config.scopes.includes(scope)}
                disabled={scope === "content:read"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scopes: e.target.checked
                      ? [...config.scopes, scope]
                      : config.scopes.filter((v) => v !== scope),
                  })
                }
              />
              {scope.replace("content:", "")}
            </label>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="block rounded border px-4 py-2"
          >
            Save editor configuration
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="my-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
