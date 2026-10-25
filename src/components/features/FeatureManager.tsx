"use client";
import { useState } from "react";
import {
  featureAdminAction,
  saveFeatureBadgeAction,
  registerFeatureAction,
} from "@/lib/actions/feature-actions";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
export function FeatureManager({
  initial,
}: {
  initial: { features: Row[]; audit: Row[] };
}) {
  const [data, setData] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    try {
      const r = await fn();
      setMessage(
        r.ok
          ? "Badge settings saved. Public interfaces refresh within 30 seconds."
          : r.error || "Could not save.",
      );
      if (r.ok) setData(await featureAdminAction());
    } catch {
      setMessage("Could not save. Check your administrator session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <p>JKTL ADMIN / FEATURE MANAGEMENT</p>
        <h1>
          A small badge.
          <br />A clear announcement.
        </h1>
        <p>
          Control NEW labels independently of product access or checkout. All
          new registry entries start with badges off.
        </p>
      </header>
      <div className={styles.body}>
        {message && <p role="status">{message}</p>}
        {data.features.map((f) => (
          <form
            key={String(f.slug) + f.revision}
            className={styles.section}
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              run(() =>
                saveFeatureBadgeAction({
                  slug: String(f.slug),
                  revision: Number(f.revision),
                  isNew: d.get("enabled") === "on",
                  startsAt: String(d.get("start") || ""),
                  endsAt: String(d.get("end") || ""),
                }),
              );
            }}
          >
            <h2>
              {String(f.name)}{" "}
              <span
                style={{
                  background: "#c9a84c",
                  color: "#060e2a",
                  fontSize: 10,
                  padding: 5,
                  borderRadius: 5,
                }}
              >
                NEW
              </span>
            </h2>
            <p>
              {String(f.category)} · {String(f.slug)} · {String(f.route)}
            </p>
            <p>{String(f.description)}</p>
            <div className={styles.fields}>
              <label className={styles.consent}>
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={Boolean(f.is_new)}
                />{" "}
                Display NEW
              </label>
              <label>
                Start (Nigeria / WAT, optional)
                <input
                  name="start"
                  type="datetime-local"
                  defaultValue={
                    f.starts_at
                      ? new Date(
                          new Date(String(f.starts_at)).getTime() + 3600000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
              <label>
                Expiration (Nigeria / WAT, optional)
                <input
                  name="end"
                  type="datetime-local"
                  defaultValue={
                    f.ends_at
                      ? new Date(
                          new Date(String(f.ends_at)).getTime() + 3600000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
            </div>
            <p className={styles.note}>
              Clear a date to remove it. Updated by{" "}
              {String(f.updated_by || "System")} ·{" "}
              {new Date(String(f.updated_at)).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
            </p>
            <button disabled={busy}>Save badge</button>
          </form>
        ))}
        <form
          className={styles.section}
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            run(() =>
              registerFeatureAction({
                slug: String(d.get("slug")),
                name: String(d.get("name")),
                category: String(d.get("category")),
                route: String(d.get("route")),
                description: String(d.get("description")),
              }),
            );
          }}
        >
          <h2>Register another feature</h2>
          <div className={styles.fields}>
            {["slug", "name", "category", "route", "description"].map((k) => (
              <label key={k}>
                {k}
                <input
                  name={k}
                  required
                  maxLength={k === "description" ? 500 : 200}
                />
              </label>
            ))}
          </div>
          <button disabled={busy}>Register with NEW off</button>
        </form>
        <section className={styles.section}>
          <h2>Badge history</h2>
          {data.audit.map((a) => (
            <p className={styles.note} key={String(a.id)}>
              {String(a.feature_slug)} · {String(a.actor_id)} ·{" "}
              {new Date(String(a.created_at)).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}{" "}
              · {JSON.stringify(a.detail)}
            </p>
          ))}
        </section>
      </div>
    </section>
  );
}
