"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PROJECT_CATEGORY_LABELS } from "@/lib/custom/contracts";
import * as support from "@/lib/actions/support-actions";
import * as reviews from "@/lib/actions/review-actions";
import { HELP_GUIDES } from "@/lib/support/knowledge";
import { useBusinessStore } from "@/lib/store";
type Row = Record<string, unknown>;
export function CustomerSupport() {
  const permissionDirty = useRef(false);
  const mode = useBusinessStore((s) => s.mode);
  const params = useSearchParams();
  const [projects, setProjects] = useState<Row[]>([]);
  const [project, setProject] = useState(params.get("project") || "");
  const [category, setCategory] = useState("WEBSITE_CONTENT");
  const [caseId, setCaseId] = useState(params.get("case") || ""),
    [cases, setCases] = useState<Row[]>([]),
    [data, setData] = useState<{
      case: Row;
      messages: Row[];
      project?: Row | null;
    } | null>(null),
    [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [scopes, setScopes] = useState<string[]>([]),
    [history, setHistory] = useState<Row[]>([]),
    [rating, setRating] = useState(0),
    [quote, setQuote] = useState(""),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false);
  const refresh = useCallback(async () => {
    if (mode !== "live") return;
    try {
      const home = await support.supportHomeAction();
      setCases(home.cases);
      setProjects(home.projects);
      if (caseId) {
        const d = await support.supportCaseAction(caseId);
        setData(d);
        if (!permissionDirty.current)
          setScopes(
            Array.isArray(d.case.consent_scopes) ? d.case.consent_scopes : [],
          );
      }
      try {
        setHistory((await reviews.reviewHomeAction()).reviews);
      } catch {}
    } catch {
      setError("Could not load support. Check your sign-in and connection.");
    }
  }, [caseId, mode]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      if (
        result &&
        typeof result === "object" &&
        "ok" in result &&
        result.ok === false
      )
        throw Error(
          "error" in result
            ? String(result.error)
            : "Could not complete the action.",
        );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (mode !== "live")
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">
          Explore the guides in demo mode
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          Sign in to your live business account to contact support, authorize
          assistance or leave feedback.
        </p>
        <a
          className="mt-4 inline-block text-primary underline"
          href="/login?next=support"
        >
          Sign in for personal help →
        </a>
      </div>
    );
  return (
    <section className="space-y-6" style={{ overflowWrap: "anywhere" }}>
      <header>
        <h1 className="text-3xl font-semibold">Help & support</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Start with the guide assistant. Ask for a person whenever you need
          one. Never send passwords, card details, OTPs or private customer
          records.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-danger p-4 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-border bg-surface p-4 text-sm"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-border p-4">
          <button
            className="mb-4 text-sm font-semibold text-primary"
            onClick={() => {
              setCaseId("");
              permissionDirty.current = false;
              setData(null);
            }}
          >
            + New conversation
          </button>
          <div className="space-y-2">
            {cases.map((c) => (
              <button
                className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
                key={String(c.id)}
                onClick={() => {
                  permissionDirty.current = false;
                  setData(null);
                  setCaseId(String(c.id));
                }}
              >
                {String(c.subject)}
                <span className="mt-1 block text-xs text-ink-muted">
                  {String(c.status)}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="rounded-2xl border border-border bg-paper p-5">
          {!caseId ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await support.createSupportCaseAction({
                    subject,
                    message: body,
                    customProjectId: project || undefined,
                    projectCategory: project ? category : undefined,
                  });
                  if (!r.ok) throw Error(r.error);
                  setCaseId(r.id!);
                  setBody("");
                });
              }}
            >
              {projects.length > 0 && (
                <label className="block text-sm">
                  Related project
                  <select
                    className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    <option value="">General account support</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {project && (
                <label className="block text-sm">
                  Category
                  <select
                    className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {Object.entries(PROJECT_CATEGORY_LABELS).map(
                      ([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                What do you need help with?
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  className="mt-2 w-full rounded-xl border border-border-strong bg-paper p-3"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Describe what you tried
                <textarea
                  required
                  maxLength={3000}
                  className="mt-2 min-h-32 w-full rounded-xl border border-border-strong bg-paper p-3"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                className="rounded-xl bg-primary px-5 py-3 text-on-primary"
              >
                {busy ? "Finding help…" : "Ask the assistant"}
              </button>
            </form>
          ) : data && data.case.id === caseId ? (
            <>
              <h2 className="text-xl font-semibold">
                {String(data.case.subject)}
              </h2>
              {data.project && (
                <p className="my-3 text-sm">
                  Project: {String(data.project.name)} ·{" "}
                  {String(data.case.project_category || "")}
                </p>
              )}
              <p className="my-3 text-sm text-ink-muted">
                {data.case.status === "AI"
                  ? "Guide assistant"
                  : data.case.status === "WAITING"
                    ? "Waiting for a support agent"
                    : data.case.status === "ESCALATED"
                      ? "Escalated to a team member"
                      : data.case.status === "RESOLVED"
                        ? "Resolved"
                        : "A support agent has taken over"}
              </p>
              <div
                className="max-h-[550px] space-y-4 overflow-auto"
                aria-live="polite"
              >
                {data.messages.map((m) => (
                  <article
                    className="rounded-xl bg-surface p-4 text-sm leading-7"
                    key={String(m.id)}
                  >
                    <strong className="text-xs uppercase tracking-wider">
                      {m.sender === "assistant"
                        ? "JKTL assistant"
                        : m.sender === "support"
                          ? "JKTL support"
                          : m.sender === "user"
                            ? "You"
                            : "Update"}
                    </strong>
                    <p className="mt-2 whitespace-pre-wrap">{String(m.body)}</p>
                    {Array.isArray(m.guide_ids) &&
                      m.guide_ids.map((g) => {
                        const guide = HELP_GUIDES.find((h) => h.id === g);
                        return guide ? (
                          <a
                            key={String(g)}
                            className="mt-2 block text-primary underline"
                            href={"#" + guide.id}
                            onClick={() => {
                              const element = document.getElementById(guide.id);
                              if (element instanceof HTMLDetailsElement)
                                element.open = true;
                            }}
                          >
                            {guide.title} →
                          </a>
                        ) : null;
                      })}
                  </article>
                ))}
              </div>
              {data.case.status !== "RESOLVED" && (
                <>
                  <form
                    className="mt-5 flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const r = await support.sendSupportMessageAction(
                          caseId,
                          body,
                        );
                        if (!r.ok) throw Error(r.error);
                        setBody("");
                      });
                    }}
                  >
                    <label className="text-sm">
                      Your message
                      <textarea
                        required
                        maxLength={3000}
                        className="mt-2 min-h-24 w-full rounded-xl border border-border-strong bg-paper p-3"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="self-start rounded-xl bg-primary px-5 py-3 text-on-primary"
                    >
                      {busy ? "Sending…" : "Send message"}
                    </button>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <button
                      disabled={busy || data.case.status !== "AI"}
                      className="rounded-xl border border-border-strong p-3"
                      onClick={() =>
                        void run(() => support.requestHumanAction(caseId))
                      }
                    >
                      Talk to a person
                    </button>
                    <button
                      disabled={busy || data.case.status === "ESCALATED"}
                      className="rounded-xl border border-border-strong p-3"
                      onClick={() =>
                        void run(() => support.requestHumanAction(caseId, true))
                      }
                    >
                      Request team review
                    </button>
                  </div>
                </>
              )}
              {["WAITING", "HUMAN"].includes(String(data.case.status)) && (
                <fieldset className="mt-6 rounded-xl border border-border-strong p-4 text-sm">
                  <legend className="px-2 font-semibold">
                    Optional website assistance
                  </legend>
                  <p className="mb-4 leading-7 text-ink-muted">
                    Only the business owner can grant access. Applies to this
                    case for 24 hours. Agents can work on an unpublished draft,
                    retain the selected template, and publish your first free
                    website only if separately authorized. No payments,
                    credentials or customer records.
                  </p>
                  {[
                    [
                      "website_draft",
                      "Allow the assigned agent to view and edit my unpublished website draft",
                    ],
                    [
                      "website_publish",
                      "Also allow the first free website publication",
                    ],
                  ].map(([scope, label]) => (
                    <label key={scope} className="mb-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={scopes.includes(scope)}
                        onChange={(e) => {
                          permissionDirty.current = true;
                          setScopes((s) =>
                            e.target.checked
                              ? [...s, scope]
                              : s.filter((v) => v !== scope),
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={busy}
                      className="rounded-lg bg-primary px-4 py-2 text-on-primary"
                      onClick={() =>
                        void run(() =>
                          support
                            .grantSupportAction(caseId, scopes)
                            .then((r) => {
                              if (r.ok) permissionDirty.current = false;
                              return r;
                            }),
                        )
                      }
                    >
                      Save permissions
                    </button>
                    <button
                      disabled={busy}
                      className="rounded-lg border border-border-strong px-4 py-2"
                      onClick={() =>
                        void run(() =>
                          support.grantSupportAction(caseId, []).then((r) => {
                            if (r.ok) permissionDirty.current = false;
                            return r;
                          }),
                        )
                      }
                    >
                      Revoke assistance
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">
                    Current expiry:{" "}
                    {data.case.consent_until
                      ? new Date(
                          String(data.case.consent_until),
                        ).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })
                      : "No active grant"}
                  </p>
                </fieldset>
              )}
            </>
          ) : (
            <p role="status">Loading conversation…</p>
          )}
        </div>
      </div>
      <section
        id="feedback"
        className="rounded-2xl border border-border bg-paper p-5"
      >
        <h2 className="text-2xl font-semibold">Your experience with JKTL</h2>
        <p className="my-3 text-sm leading-7 text-ink-muted">
          All ratings are welcome. A positive rating is never required for
          support. Only the business owner can submit or withdraw a review.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await reviews.submitBusinessReviewAction({
                rating,
                quote,
                displayName: name,
                publicConsent: consent,
              });
              if (!result.ok) throw Error(result.error);
              setQuote("");
              setNotice("Feedback saved. Thank you.");
            });
          }}
        >
          <label className="block text-sm">
            Rating
            <select
              className="ml-3 rounded-lg border border-border-strong bg-paper p-2"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              <option value={0} disabled>
                Choose a rating
              </option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Display name
            <input
              required
              minLength={2}
              maxLength={100}
              className="mt-2 w-full rounded-xl border border-border-strong bg-paper p-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Your feedback
            <textarea
              required
              minLength={20}
              maxLength={1500}
              className="mt-2 min-h-28 w-full rounded-xl border border-border-strong bg-paper p-3"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I allow JKTL to publish this exact review, rating, display name and
            business name on its main site. This is optional; I can withdraw
            permission here.
          </label>
          <button
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-3 text-on-primary"
          >
            Save feedback
          </button>
        </form>
        <div className="mt-6 space-y-3">
          {history.map((r) => (
            <article
              className="rounded-xl bg-surface p-4 text-sm"
              key={String(r.id)}
            >
              <p>
                {String(r.rating)} / 5 · {String(r.status)}
              </p>
              <p className="my-3">{String(r.quote)}</p>
              {r.status !== "WITHDRAWN" && (
                <button
                  className="text-primary underline"
                  onClick={() =>
                    void run(() =>
                      reviews.withdrawBusinessReviewAction(String(r.id)),
                    )
                  }
                >
                  Withdraw this review
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
