"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as actions from "@/lib/actions/support-actions";
import { websiteTemplates } from "@/lib/website-templates";
import { subscribeToPush, isPushSupported } from "@/lib/push-client";
import { AddToHomeScreenGuide } from "@/components/help/add-to-home-screen-guide";
import { WebsiteDraftPreview } from "./website-draft-preview";
import { WebsiteFields } from "./website-fields";
import { HelpLibrary } from "./help-library";
type Row = Record<string, unknown>;
export function StaffSupport() {
  const params = useSearchParams();
  const [queue, setQueue] = useState<Row[]>([]),
    [isOwner, setIsOwner] = useState(false),
    [installEvent, setInstallEvent] = useState<
      (Event & { prompt: () => Promise<void> }) | null
    >(null),
    [caseId, setCaseId] = useState(params.get("case") || ""),
    [data, setData] = useState<Awaited<
      ReturnType<typeof actions.staffSupportCaseAction>
    > | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [templateId, setTemplateId] = useState(""),
    [document, setDocument] = useState(""),
    [draftRevision, setDraftRevision] = useState(0),
    [guide, setGuide] = useState(true);
  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const result = await actions.supportQueueAction();
      setQueue(result.cases);
      setIsOwner(result.owner);
      if (caseId) setData(await actions.staffSupportCaseAction(caseId));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not refresh support.");
    }
  }, [caseId]);
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
    setMessage("");
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
      setMessage(
        e instanceof Error ? e.message : "Could not complete the action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadDraft() {
    if (!data?.website) return;
    setTemplateId(String(data.website.website_template_id || ""));
    setDraftRevision(Number(data.website.website_revision));
    setDocument(
      data.website.website_document &&
        (data.website.website_document as { version?: number }).version === 1
        ? JSON.stringify(data.website.website_document, null, 2)
        : "",
    );
  }
  return (
    <div className="space-y-8" style={{ overflowWrap: "anywhere" }}>
      <header>
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          JKTL customer care
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Support inbox</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Claim a request, continue the conversation and help the customer
          finish their next step. Sensitive requests go to an owner
          administrator.
        </p>
      </header>
      {guide && (
        <section className="rounded-2xl border border-border-strong bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Keep support within reach</h2>
            <button
              className="text-xs underline"
              onClick={() => setGuide(false)}
            >
              Hide this guide
            </button>
          </div>
          <p className="my-3 text-sm leading-7 text-ink-muted">
            Add the Support workspace to your home screen, open it and enable
            alerts for this device. Installation alone does not enable
            notifications. The inbox remains available when push is unavailable.
          </p>
          <button
            type="button"
            className="my-4 rounded-xl border border-border-strong p-3 text-sm"
            onClick={() =>
              void run(async () => {
                if (installEvent) {
                  await installEvent.prompt();
                  setInstallEvent(null);
                } else
                  setMessage(
                    "Use the browser installation instructions below. On iPhone, open this Support page in Safari and add it to your home screen.",
                  );
              })
            }
          >
            Install Support app
          </button>
          <AddToHomeScreenGuide />
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
              onClick={() =>
                void run(async () => {
                  if (!isPushSupported())
                    throw Error(
                      "Push is unavailable here. On iPhone, install and open the home-screen app first. This deployment also needs VAPID notification keys.",
                    );
                  const registration =
                    await navigator.serviceWorker.getRegistration("/");
                  if (!registration?.active)
                    throw Error(
                      "The app is not ready for alerts yet. Open or refresh the installed Support app and try again.",
                    );
                  const sub = await subscribeToPush();
                  if (!sub)
                    throw Error(
                      "Notifications were not enabled. Check browser and device permissions.",
                    );
                  const result = await actions.supportDeviceAction(sub);
                  if (!result.ok) throw Error(result.error);
                  setMessage(
                    "This device is registered for support alerts while your staff session remains active.",
                  );
                })
              }
            >
              Enable support alerts
            </button>
            <button
              disabled={busy}
              className="rounded-xl border border-border-strong px-4 py-3 text-sm"
              onClick={() =>
                void run(async () => {
                  if (!("serviceWorker" in navigator))
                    throw Error(
                      "This browser does not support app notifications.",
                    );
                  const registration =
                    await navigator.serviceWorker.getRegistration("/");
                  if (!registration?.active)
                    throw Error(
                      "No active notification registration on this device.",
                    );
                  const sub = await registration.pushManager.getSubscription();
                  if (sub) {
                    const json = sub.toJSON();
                    const result = await actions.supportDeviceAction(
                      { endpoint: json.endpoint, ...json.keys },
                      true,
                    );
                    if (!result.ok) throw Error(result.error);
                  }
                  setMessage(
                    "Support alerts disabled for this staff account on this device.",
                  );
                })
              }
            >
              Disable support alerts
            </button>
            <button
              disabled={busy}
              className="rounded-xl border border-border-strong px-4 py-3 text-sm"
              onClick={() => void run(() => actions.retrySupportAlertsAction())}
            >
              Retry queued alerts
            </button>
          </div>
        </section>
      )}
      {!guide && (
        <button
          className="text-sm text-primary underline"
          onClick={() => setGuide(true)}
        >
          Installation & notification guide
        </button>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-border-strong bg-surface p-4 text-sm"
        >
          {message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          {queue.length === 0 && (
            <p className="text-sm text-ink-muted">No cases in your queue.</p>
          )}
          {queue.map((c) => (
            <button
              key={String(c.id)}
              className="block w-full rounded-2xl border border-border bg-paper p-4 text-left text-sm"
              onClick={() => {
                setCaseId(String(c.id));
                setData(null);
                setDocument("");
              }}
            >
              <strong>{String(c.subject)}</strong>
              <p className="mt-2 text-ink-muted">
                {String(c.business_name)} · {String(c.status)}
              </p>
            </button>
          ))}
        </aside>
        <section className="min-w-0 rounded-2xl border border-border bg-paper p-5">
          {!data || data.case.id !== caseId ? (
            <p className="text-sm text-ink-muted">Select a case to continue.</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold">
                {String(data.case.subject)}
              </h2>
              <p className="my-3 text-sm text-ink-muted">
                {String(data.case.status)} ·{" "}
                {data.case.sensitive
                  ? "Administrator review required"
                  : "Routine assistance"}
              </p>
              {(!data.case.assigned_to || isOwner) && (
                <button
                  disabled={busy}
                  className="mb-5 rounded-xl bg-primary px-4 py-3 text-sm text-on-primary"
                  onClick={() =>
                    void run(() => actions.claimSupportCaseAction(caseId))
                  }
                >
                  {data.case.assigned_to ? "Take over case" : "Claim case"}
                </button>
              )}
              <div
                className="max-h-[450px] space-y-3 overflow-auto"
                aria-live="polite"
              >
                {data.messages.map((m) => (
                  <article
                    key={String(m.id)}
                    className="rounded-xl bg-surface p-4 text-sm leading-7"
                  >
                    <strong>{String(m.sender)}</strong>
                    <p className="whitespace-pre-wrap">{String(m.body)}</p>
                  </article>
                ))}
              </div>
              <label className="mt-5 block text-sm">
                Reply or internal note
                <textarea
                  maxLength={3000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-2 min-h-28 w-full rounded-xl border border-border-strong bg-paper p-3"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  ["reply", "Send reply"],
                  ["note", "Save internal note"],
                  ["resolve", "Reply and resolve"],
                  ["escalate", "Escalate to administrator"],
                ].map(([kind, label]) => (
                  <button
                    disabled={
                      busy ||
                      !body.trim() ||
                      !["HUMAN", "ESCALATED"].includes(String(data.case.status))
                    }
                    key={kind}
                    className="rounded-xl border border-border-strong px-4 py-3 text-sm"
                    onClick={() =>
                      void run(async () => {
                        const result = await actions.staffSupportReplyAction(
                          caseId,
                          body,
                          kind as "reply" | "note" | "resolve" | "escalate",
                        );
                        if (!result.ok) throw Error(result.error);
                        setBody("");
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <details className="mt-6 rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">
                  Internal notes
                </summary>
                {data.notes.map((n) => (
                  <p
                    key={String(n.id)}
                    className="my-3 whitespace-pre-wrap text-sm leading-7"
                  >
                    {String(n.body)}
                  </p>
                ))}
              </details>
              <details className="mt-6 rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">
                  Authorized website assistance
                </summary>
                <p className="my-3 text-sm leading-7 text-ink-muted">
                  The customer must grant draft access for this case and remain
                  the active business owner. Grants expire after 24 hours.
                  Support can edit an unpublished draft or publish it for the
                  first time with separate consent. Published websites,
                  payments, credentials, domain ownership and provisioning
                  remain outside this tool.
                </p>
                {data.website && !data.website.published ? (
                  <>
                    <p className="text-sm">
                      {String(data.website.display_name)} ·{" "}
                      {String(data.website.subdomain)} · version{" "}
                      {String(data.website.website_revision)}
                    </p>
                    <button
                      className="my-4 rounded-xl border border-border-strong p-3 text-sm"
                      onClick={() => void loadDraft()}
                    >
                      Load current draft for review
                    </button>
                    <label className="block text-sm">
                      Template
                      <select
                        aria-label="Template"
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                        className="my-2 w-full rounded-xl border border-border-strong bg-paper p-3"
                      >
                        <option value="">
                          Choose a template only if none is already selected
                        </option>
                        {websiteTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy || !templateId}
                      className="my-3 rounded-xl border border-border-strong p-3 text-sm"
                      onClick={() =>
                        void run(async () =>
                          setDocument(
                            JSON.stringify(
                              await actions.starterDocumentAction(
                                templateId,
                                caseId,
                              ),
                              null,
                              2,
                            ),
                          ),
                        )
                      }
                    >
                      Prepare template starting content
                    </button>
                    {document && (
                      <WebsiteFields
                        value={JSON.parse(document)}
                        onChange={(d) => setDocument(JSON.stringify(d))}
                      />
                    )}
                    <p className="my-3 text-xs leading-6 text-ink-muted">
                      Confirm content with the customer before saving. Reload
                      after a revision conflict; do not replace their selected
                      design.
                    </p>
                    {document && (
                      <WebsiteDraftPreview
                        templateId={templateId}
                        document={document}
                      />
                    )}
                    <div className="flex flex-wrap gap-3">
                      <button
                        disabled={busy || !document}
                        className="rounded-xl bg-primary p-3 text-sm text-on-primary"
                        onClick={() =>
                          void run(() =>
                            actions.assistedWebsiteAction(caseId, {
                              templateId,
                              document: JSON.parse(document),
                              revision: draftRevision,
                              publish: false,
                            }),
                          )
                        }
                      >
                        Save authorized draft
                      </button>
                      <button
                        disabled={busy || !document}
                        className="rounded-xl border border-border-strong p-3 text-sm"
                        onClick={() =>
                          void run(() =>
                            actions.assistedWebsiteAction(caseId, {
                              templateId,
                              document: JSON.parse(document),
                              revision: draftRevision,
                              publish: true,
                            }),
                          )
                        }
                      >
                        Publish first free website
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {data.website?.published
                      ? "This website is already published. Guide the owner through their own editor for further changes."
                      : "No current draft permission for your assignment. Ask the owner to grant it in their conversation."}
                  </p>
                )}
              </details>
              <details className="mt-6 rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">
                  Case audit history
                </summary>
                {data.audit.map((a, i) => (
                  <p className="my-3 break-words text-xs leading-6" key={i}>
                    {String(a.event)} ·{" "}
                    {new Date(String(a.created_at)).toLocaleString("en-NG", {
                      timeZone: "Africa/Lagos",
                    })}
                  </p>
                ))}
              </details>
            </>
          )}
        </section>
      </div>
      <HelpLibrary />
    </div>
  );
}
