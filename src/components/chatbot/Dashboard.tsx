"use client";
import { useState } from "react";
import Link from "next/link";
import {
  chatbotHome,
  chatbotChange,
  chatbotConversation,
  chatbotReply,
} from "@/lib/actions/chatbot-actions";
import { settings, type BotSettings } from "@/lib/chatbot/model";
import type { dashboard } from "@/lib/chatbot/management";
import { FeatureBadge } from "@/components/features/FeatureBadge";
type Data = Awaited<ReturnType<typeof dashboard>>;
const field =
  "w-full rounded-xl border border-border-strong bg-paper px-3 py-2 text-sm text-ink";
const button =
  "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export function ChatbotDashboard({
  initial,
  target,
}: {
  initial: Data;
  target?: string;
}) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState(String(initial.bots[0]?.id || "")),
    [tab, setTab] = useState("Overview"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function change(operation: string, input: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const result = await chatbotChange(target, operation, input);
      if (!result.ok) throw Error(result.error);
      const fresh = await chatbotHome(target);
      setData(fresh);
      if (operation === "deleteBot")
        setSelected(String(fresh.bots[0]?.id || ""));
      if (operation === "create")
        setSelected(String(fresh.bots.at(-1)?.id || ""));
      setNotice("Saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  const bot = data.bots.find((row) => row.id === selected);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <p className="text-sm font-semibold text-primary">
          JKTL BUSINESS PRODUCTS
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          JKTL AI Chatbot <FeatureBadge slug="ai-chatbot" />
        </h1>
        <p className="mt-3 text-ink-muted">
          Turn website visitors into conversations and customers.
        </p>
        <p className="mt-2 text-sm">
          Free to start. Larger allowances use your existing JKTL subscription.
        </p>
      </header>
      {!data.productEnabled && (
        <p role="status" className="rounded-xl bg-surface p-4">
          JKTL has temporarily disabled public chatbot service. Your saved
          configuration is preserved.
        </p>
      )}
      {!data.providerReady && (
        <p className="rounded-xl border border-border p-4 text-sm">
          Approved knowledge, enquiries and WhatsApp work now. Live AI
          generation is unavailable until JKTL configures and verifies the
          provider.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Plan", String(data.entitlements.plan_id)],
          [
            "Completed AI replies this UTC month",
            `${data.usage.completed || 0} / ${data.entitlements.responses}`,
          ],
          [
            "Remaining AI replies",
            String(
              Math.max(
                0,
                Number(data.entitlements.responses) -
                  Number(data.usage.completed || 0),
              ),
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border p-4">
            <p className="text-xs text-ink-muted">{label}</p>
            <strong className="mt-2 block text-xl">{value}</strong>
          </div>
        ))}
      </div>
      <Link href="/business/plans" className="text-sm text-primary underline">
        Manage or upgrade your existing plan
      </Link>
      {data.actor.manager && (
        <details
          className="rounded-2xl border border-border p-4"
          open={!data.bots.length}
        >
          <summary className="cursor-pointer font-semibold">
            Create a chatbot ({data.bots.length}/
            {String(data.entitlements.bots)})
          </summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              void change("create", {
                name: f.get("name"),
                slug: f.get("slug"),
              });
            }}
          >
            <label>
              Assistant name
              <input
                className={field}
                name="name"
                placeholder="e.g. Mika"
                required
                maxLength={80}
              />
            </label>
            <label>
              Public chat slug
              <input
                className={field}
                name="slug"
                required
                pattern="[a-z0-9][a-z0-9-]{2,59}"
                placeholder="your-business-assistant"
              />
            </label>
            <button
              className={button}
              disabled={
                busy || data.bots.length >= Number(data.entitlements.bots)
              }
            >
              Create chatbot
            </button>
          </form>
        </details>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-surface p-3 text-sm">
          {notice}
        </p>
      )}
      {data.bots.length > 0 && (
        <>
          <label>
            Select chatbot
            <select
              className={field}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {data.bots.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.name)}
                </option>
              ))}
            </select>
          </label>
          <nav className="flex flex-wrap gap-2" aria-label="Chatbot sections">
            {[
              "Overview",
              "Knowledge Base",
              "Appearance",
              "Conversations & Leads",
              "Installation",
              "Settings",
            ].map((name) => (
              <button
                key={name}
                className={`rounded-xl border px-3 py-2 text-sm ${tab === name ? "bg-primary text-white" : "border-border"}`}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </nav>
        </>
      )}
      {bot && (
        <BotPanel
          key={String(bot.id)}
          bot={bot}
          data={data}
          tab={tab}
          target={target}
          busy={busy}
          change={change}
        />
      )}
    </div>
  );
}
function BotPanel({
  bot,
  data,
  tab,
  target,
  busy,
  change,
}: {
  bot: Data["bots"][number];
  data: Data;
  tab: string;
  target?: string;
  busy: boolean;
  change: (op: string, input: Record<string, unknown>) => Promise<void>;
}) {
  const [config, setConfig] = useState<BotSettings>(() =>
      settings(bot.settings),
    ),
    [name, setName] = useState(String(bot.name)),
    [enabled, setEnabled] = useState(Boolean(bot.enabled)),
    [editing, setEditing] = useState(""),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [messages, setMessages] = useState<Record<string, unknown>[]>([]),
    [sessionId, setSessionId] = useState(""),
    [error, setError] = useState("");
  const rows = (key: keyof Data["bots"][number]) =>
    Array.isArray(bot[key]) ? (bot[key] as Record<string, unknown>[]) : [];
  const id = String(bot.id),
    can = data.actor.manager;
  const save = () =>
    change("settings", {
      botId: id,
      name,
      enabled,
      revision: bot.revision,
      settings: config,
    });
  const set = (key: keyof BotSettings, value: unknown) =>
    setConfig((current) => ({ ...current, [key]: value }));
  if (tab === "Overview")
    return (
      <section className="rounded-2xl border border-border p-5">
        <h2 className="text-xl font-semibold">{String(bot.name)}</h2>
        <p className="my-3">
          {bot.suspended
            ? "Suspended by JKTL"
            : bot.enabled
              ? "Enabled"
              : "Disabled"}
          . Messages retained for {String(data.entitlements.retention_days)}{" "}
          days.
        </p>
        <a
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
          href={data.origin + "/chatbots/c/" + bot.slug}
        >
          Open standalone chat ↗
        </a>
        <p className="mt-3 text-sm text-ink-muted">
          {String(bot.conversations_count || 0)} total conversations ·{" "}
          {String(bot.leads_count || 0)} enquiries ·{" "}
          {String(bot.handoffs_count || 0)} human follow-up requests.
          Conversation content is only available within your retention period.
        </p>
        <div className="mt-4 space-y-1 text-sm">
          {rows("trends").map((row) => (
            <p key={String(row.day)}>
              {String(row.day).slice(0, 10)}: {String(row.conversations)}{" "}
              conversations
            </p>
          ))}
        </div>
        {rows("questions").length > 0 && (
          <details className="mt-4">
            <summary>Common questions</summary>
            {rows("questions").map((row, index) => (
              <p key={index} className="mt-2 break-words text-sm">
                {String(row.question)} ({String(row.count)})
              </p>
            ))}
          </details>
        )}
      </section>
    );
  if (tab === "Knowledge Base")
    return (
      <section>
        <h2 className="text-xl font-semibold">Approved business knowledge</h2>
        <p className="my-3 text-sm">
          {rows("knowledge").length} saved entries · plan limit{" "}
          {String(data.entitlements.knowledge)}. Only approved content is used;
          excess entries after a downgrade are not served.
        </p>
        {can && (
          <form
            className="grid gap-3 rounded-2xl border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void change("knowledge", {
                botId: id,
                id: editing || undefined,
                title,
                content,
              }).then(() => {
                setEditing("");
                setTitle("");
                setContent("");
              });
            }}
          >
            <label>
              Question or title
              <input
                className={field}
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Approved answer or information
              <textarea
                className={field}
                required
                maxLength={4000}
                rows={5}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            <button className={button} disabled={busy}>
              Save knowledge
            </button>
          </form>
        )}
        <div className="mt-4 space-y-3">
          {rows("knowledge").map((row) => (
            <article
              key={String(row.id)}
              className="rounded-2xl border border-border p-4"
            >
              <h3 className="font-semibold">{String(row.title)}</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {String(row.content)}
              </p>
              {can && (
                <div className="mt-3 flex gap-4 text-sm">
                  <button
                    className="text-primary underline"
                    onClick={() => {
                      setEditing(String(row.id));
                      setTitle(String(row.title));
                      setContent(String(row.content));
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-danger"
                    onClick={() => {
                      if (confirm("Delete this knowledge entry?"))
                        void change("deleteKnowledge", {
                          botId: id,
                          id: row.id,
                        });
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  if (tab === "Appearance" || tab === "Settings")
    return (
      <form
        className="grid gap-4 rounded-2xl border border-border p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 className="text-xl font-semibold">{tab}</h2>
        <fieldset disabled={!can || busy} className="grid gap-4">
          <label>
            Assistant name
            <input
              className={field}
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {tab === "Appearance" ? (
            <>
              <label>
                Welcome message
                <textarea
                  className={field}
                  maxLength={500}
                  value={config.welcome}
                  onChange={(event) => set("welcome", event.target.value)}
                />
              </label>
              <label>
                Accent colour
                <input
                  className={field}
                  type="color"
                  value={config.color}
                  onChange={(event) => set("color", event.target.value)}
                />
              </label>
              <label>
                Avatar image URL (HTTPS)
                <input
                  className={field}
                  type="url"
                  value={config.avatar}
                  onChange={(event) => set("avatar", event.target.value)}
                />
              </label>
              <label>
                Tone
                <select
                  className={field}
                  value={config.tone}
                  onChange={(event) => set("tone", event.target.value)}
                >
                  {["friendly", "professional", "concise"].map((tone) => (
                    <option key={tone}>{tone}</option>
                  ))}
                </select>
              </label>
              {Boolean(data.entitlements.remove_branding) && (
                <label>
                  <input
                    type="checkbox"
                    checked={config.hideBranding}
                    onChange={(event) =>
                      set("hideBranding", event.target.checked)
                    }
                  />{" "}
                  Remove JKTL branding
                </label>
              )}
            </>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />{" "}
                Enable this chatbot
              </label>
              <label>
                Approved business information
                <textarea
                  className={field}
                  rows={6}
                  maxLength={4000}
                  value={config.businessInfo}
                  onChange={(event) => set("businessInfo", event.target.value)}
                />
              </label>
              <label>
                WhatsApp number, including country code
                <input
                  className={field}
                  value={config.whatsapp}
                  onChange={(event) => set("whatsapp", event.target.value)}
                />
              </label>
              <label>
                Business phone
                <input
                  className={field}
                  value={config.phone}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </label>
              <label>
                Business email
                <input
                  className={field}
                  type="email"
                  value={config.email}
                  onChange={(event) => set("email", event.target.value)}
                />
              </label>
              <label>
                Booking instructions
                <textarea
                  className={field}
                  value={config.bookingInstructions}
                  maxLength={1000}
                  onChange={(event) =>
                    set("bookingInstructions", event.target.value)
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.leadCapture}
                  onChange={(event) => set("leadCapture", event.target.checked)}
                />{" "}
                Allow enquiries and human support requests
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.syncWebsite}
                  onChange={(event) => set("syncWebsite", event.target.checked)}
                />{" "}
                Include my currently published JKTL website content
              </label>
              <label>
                Optional JKTL Custom website
                <select
                  className={field}
                  value={config.customProjectId}
                  onChange={(event) =>
                    set("customProjectId", event.target.value)
                  }
                >
                  <option value="">None</option>
                  {data.projects.map((project) => (
                    <option key={String(project.id)} value={String(project.id)}>
                      {String(project.name)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button className={button}>Save settings</button>
          {tab === "Settings" && (
            <button
              type="button"
              className="text-danger underline"
              onClick={() => {
                if (
                  confirm("Delete this chatbot and its retained conversations?")
                )
                  void change("deleteBot", { botId: id });
              }}
            >
              Delete chatbot
            </button>
          )}
        </fieldset>
      </form>
    );
  if (tab === "Installation")
    return (
      <section className="space-y-5 rounded-2xl border border-border p-5">
        <h2 className="text-xl font-semibold">Install your chatbot</h2>
        <p>
          Standalone link:{" "}
          <a
            className="break-all text-primary underline"
            href={data.origin + "/chatbots/c/" + bot.slug}
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.origin + "/chatbots/c/" + bot.slug}
          </a>
        </p>
        {can && (
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void change("builder", {
                botId: id,
                enabled: !bot.install_on_builder,
              })
            }
          >
            {bot.install_on_builder
              ? "Disable on my JKTL website"
              : "Enable on my JKTL website"}
          </button>
        )}
        <p className="text-sm">
          Builder installation applies to your published website automatically.
          For Custom or external sites, verify the exact hostname and add the
          script below.
        </p>
        {can && (
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void change("domain", {
                botId: id,
                hostname: new FormData(event.currentTarget).get("hostname"),
              });
            }}
          >
            <label className="flex-1">
              Website hostname
              <input
                className={field}
                name="hostname"
                required
                placeholder="www.example.com"
              />
            </label>
            <button className={button} disabled={busy}>
              Register domain
            </button>
          </form>
        )}
        {rows("domains").map((row) => (
          <article
            key={String(row.id)}
            className="rounded-xl bg-surface p-4 text-sm"
          >
            <strong>{String(row.hostname)}</strong>
            <p>
              {row.verified_at
                ? "Verified for 30 days from " +
                  String(row.verified_at).slice(0, 10)
                : "Add the following DNS TXT record:"}
            </p>
            <p className="mt-2 break-all">
              Name: _jktl-chatbot.{String(row.hostname)}
              <br />
              Value: {String(row.verification_token)}
            </p>
            {can && (
              <div className="mt-3 flex gap-4">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void change("verifyDomain", { botId: id, id: row.id })
                  }
                >
                  Check DNS
                </button>
                <button
                  onClick={() => {
                    if (confirm("Remove this authorized hostname?"))
                      void change("removeDomain", { botId: id, id: row.id });
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </article>
        ))}
        {data.widgetDeployed ? (
          <>
            <label>
              Verified widget installation code
              <textarea
                readOnly
                className={field + " mt-2 font-mono"}
                rows={4}
                value={`<script src="${data.origin}/chatbots/widget.js" data-chatbot-id="${id}" async></script>`}
              />
            </label>
            <button
              className={button}
              onClick={() =>
                navigator.clipboard.writeText(
                  `<script src="${data.origin}/chatbots/widget.js" data-chatbot-id="${id}" async></script>`,
                )
              }
            >
              Copy installation code
            </button>
          </>
        ) : (
          <p role="status">
            The public widget URL has not passed its deployment check yet.
            Installation code will appear once {data.origin}/chatbots/widget.js
            responds correctly.
          </p>
        )}
      </section>
    );
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Conversations & Leads</h2>
      <p className="text-sm">
        Human follow-up requests are asynchronous. WhatsApp opens a separate
        conversation; it is not live takeover inside JKTL.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 font-semibold">Retained conversations</h3>
          {rows("sessions").map((row) => (
            <div
              key={String(row.id)}
              className="mb-2 rounded-xl border border-border p-3 text-sm"
            >
              <button
                className="text-primary underline"
                onClick={async () => {
                  try {
                    setSessionId(String(row.id));
                    setMessages(
                      await chatbotConversation(target, id, String(row.id)),
                    );
                  } catch {
                    setError("This conversation is no longer available.");
                  }
                }}
              >
                {String(row.created_at).slice(0, 16)} · {String(row.status)}
              </button>
              {can && (
                <button
                  className="ml-3 text-danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this conversation and its captured enquiries?",
                      )
                    )
                      void change("deleteConversation", {
                        botId: id,
                        id: row.id,
                      });
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {messages.map((row, index) => (
            <p
              key={index}
              className="mb-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm"
            >
              <b>{String(row.role)}:</b> {String(row.content)}
            </p>
          ))}
          {sessionId && Boolean(data.entitlements.team_inbox) && (
            <form
              className="mt-3 space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  message = String(new FormData(form).get("message") || "");
                const result = await chatbotReply(
                  target,
                  id,
                  sessionId,
                  message,
                );
                if (result.ok) {
                  setMessages(await chatbotConversation(target, id, sessionId));
                  form.reset();
                } else setError(result.error || "Unable to reply.");
              }}
            >
              <label>
                Business follow-up message
                <textarea
                  className={field}
                  name="message"
                  required
                  maxLength={2000}
                />
              </label>
              <button className={button}>Send follow-up</button>
            </form>
          )}
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Enquiries</h3>
          {rows("leads").map((row) => (
            <article
              key={String(row.id)}
              className="mb-3 rounded-xl border border-border p-4 text-sm"
            >
              <strong>
                {String(row.name)} · {String(row.kind)}
              </strong>
              <p>
                {String(row.email)} {String(row.phone)}
              </p>
              <p className="my-2 whitespace-pre-wrap break-words">
                {String(row.enquiry)}
              </p>
              {row.kind === "appointment" && (
                <p>
                  Appointment request awaiting business confirmation.{" "}
                  <Link href="/business/bookings" className="underline">
                    Open bookings
                  </Link>
                </p>
              )}
              <p>
                Marketing consent:{" "}
                {row.marketing_consent ? "Opted in" : "Not given"}
              </p>
              {can ? (
                <select
                  className={field}
                  value={String(row.status)}
                  onChange={(event) =>
                    void change("leadStatus", {
                      botId: id,
                      id: row.id,
                      status: event.target.value,
                    })
                  }
                >
                  {["OPEN", "CONTACTED", "CLOSED"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              ) : (
                <p>{String(row.status)}</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
