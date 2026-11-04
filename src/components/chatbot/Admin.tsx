"use client";
import { useState } from "react";
import {
  chatbotAdminChange,
  chatbotAdminHome,
  chatbotSupportReview,
} from "@/lib/actions/chatbot-admin-actions";
import { priceNGN } from "@/lib/website-pricing";
type Data = Awaited<ReturnType<typeof chatbotAdminHome>>;
const field =
  "w-full rounded-xl border border-border-strong bg-paper px-3 py-2 text-sm";
const button =
  "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white";
function values(form: HTMLFormElement, booleans: string[]) {
  const f = new FormData(form),
    result: Record<string, unknown> = Object.fromEntries(f);
  for (const key of booleans) result[key] = f.has(key);
  return result;
}
export function ChatbotAdmin({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial),
    [message, setMessage] = useState(""),
    [review, setReview] = useState<Record<string, unknown>[]>([]);
  async function save(operation: string, input: Record<string, unknown>) {
    setMessage("Saving…");
    const result = await chatbotAdminChange(operation, input);
    setMessage(result.ok ? "Saved." : result.error || "Unable to save.");
    if (result.ok) setData(await chatbotAdminHome());
  }
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-5">
      <h1 className="text-3xl font-bold">JKTL AI Chatbot management</h1>
      <p>
        Existing website plans provide the entitlements below. Customer
        subscription prices are unchanged.
      </p>
      {message && <p role="status">{message}</p>}
      <form
        className="grid gap-4 rounded-2xl border border-border p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = values(event.currentTarget, [
            "product_enabled",
            "ai_enabled",
            "model_verified",
          ]);
          value.daily_cap_micro_usd = Math.round(Number(value.dailyUsd) * 1e6);
          void save("settings", value);
        }}
      >
        <h2 className="text-xl font-semibold sm:col-span-2">
          Provider and spend controls
        </h2>
        <p className="text-sm sm:col-span-2">
          Provider credentials:{" "}
          {data.keyConfigured
            ? "Configured server-side"
            : "Not configured. Add DEEPSEEK_API_KEY securely."}{" "}
          No live AI calls are made by this screen.
        </p>
        {["product_enabled", "ai_enabled", "model_verified"].map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              name={key}
              defaultChecked={Boolean(data.settings[key])}
            />{" "}
            {
              (
                {
                  product_enabled: "Enable chatbot product",
                  ai_enabled: "Enable paid AI generation",
                  model_verified:
                    "I verified this model and its published token rates",
                } as Record<string, string>
              )[key]
            }
          </label>
        ))}
        <label>
          Verified model ID
          <input
            className={field}
            name="model"
            defaultValue={String(data.settings.model || "")}
            maxLength={100}
          />
        </label>
        {["input_usd_per_million", "output_usd_per_million"].map((key) => (
          <label key={key}>
            {key === "input_usd_per_million" ? "Input" : "Output"} cost, USD per
            million tokens
            <input
              className={field}
              type="number"
              min="0"
              max="10000"
              step="0.000001"
              name={key}
              defaultValue={
                data.settings[key] === null ? "" : String(data.settings[key])
              }
            />
          </label>
        ))}
        <label>
          Global daily internal AI cost cap (USD)
          <input
            className={field}
            type="number"
            name="dailyUsd"
            min="0"
            step="0.01"
            defaultValue={Number(data.settings.daily_cap_micro_usd) / 1e6}
          />
        </label>
        <label>
          Maximum output tokens
          <input
            className={field}
            type="number"
            name="max_output_tokens"
            min="64"
            max="2048"
            defaultValue={Number(data.settings.max_output_tokens)}
          />
        </label>
        <button className={button}>Save provider controls</button>
      </form>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Plan entitlements</h2>
        {data.entitlements.map((ent) => (
          <form
            key={String(ent.plan_id)}
            className="grid gap-3 rounded-2xl border border-border p-5 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = values(event.currentTarget, [
                "enabled",
                "appointments",
                "team_inbox",
                "remove_branding",
                "advanced_leads",
              ]);
              value.plan_id = ent.plan_id;
              value.monthly_cap_micro_usd = Math.round(
                Number(value.monthlyUsd) * 1e6,
              );
              void save("entitlement", value);
            }}
          >
            <h3 className="font-semibold sm:col-span-3">
              {data.plans.find((plan) => plan.id === ent.plan_id)?.name} ·
              current website price{" "}
              {priceNGN(
                data.plans.find((plan) => plan.id === ent.plan_id)
                  ?.monthlyKobo || 0,
              )}
              /month
            </h3>
            {[
              ["bots", "Chatbots"],
              ["responses", "Completed AI replies / UTC month"],
              ["knowledge", "Knowledge entries"],
              ["retention_days", "Conversation retention days"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className={field}
                  type="number"
                  min={key === "retention_days" ? 1 : 0}
                  name={key}
                  defaultValue={Number(ent[key])}
                />
              </label>
            ))}
            <label>
              Monthly internal AI cost cap per organisation (USD)
              <input
                className={field}
                type="number"
                min="0"
                step="0.01"
                name="monthlyUsd"
                defaultValue={Number(ent.monthly_cap_micro_usd) / 1e6}
              />
            </label>
            {["analytics", "branding"].map((key) => (
              <label key={key}>
                {key}
                <select
                  className={field}
                  name={key}
                  defaultValue={String(ent[key])}
                >
                  {["basic", "standard", "advanced"].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            ))}
            {[
              "enabled",
              "appointments",
              "team_inbox",
              "remove_branding",
              "advanced_leads",
            ].map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={Boolean(ent[key])}
                />{" "}
                {key.replaceAll("_", " ")}
              </label>
            ))}
            <button className={button}>Save plan entitlements</button>
          </form>
        ))}
      </section>
      <form
        className="flex flex-wrap gap-3 rounded-2xl border border-border p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          void save("orgCap", {
            organization: f.get("org"),
            cap: Math.round(Number(f.get("usd")) * 1e6),
          });
        }}
      >
        <h2 className="w-full font-semibold">Organisation-specific cost cap</h2>
        <label>
          Organisation ID
          <input className={field} name="org" required />
        </label>
        <label>
          Monthly internal cost cap (USD)
          <input
            className={field}
            name="usd"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>
        <button className={button}>Set cap</button>
      </form>
      <section className="rounded-2xl border border-border p-5">
        <h2 className="text-xl font-semibold">Usage and cost estimates</h2>
        <p className="my-3 text-sm">
          Costs use recorded tokens and the verified rates configured at
          generation time. They are not customer charges or a provider invoice.
          Unknown usage is never reported as zero cost.
        </p>
        {data.usage.map((row) => (
          <p key={String(row.period)} className="my-2">
            {String(row.period).slice(0, 7)} · {String(row.responses)} completed
            AI replies · estimated USD{" "}
            {(Number(row.estimated_micro_usd) / 1e6).toFixed(6)}
          </p>
        ))}
        <p className="text-sm">
          Uncertain requests or missing token accounting:{" "}
          {String(data.unknown.count)}. Conservatively reserved cost: USD{" "}
          {(Number(data.unknown.reserved) / 1e6).toFixed(6)}.
        </p>
      </section>
      <section className="rounded-2xl border border-border p-5">
        <h2 className="text-xl font-semibold">Daily anomaly review</h2>
        <p className="my-3 text-sm">
          Flags over 1,000 requests or at least five uncertain provider calls
          per chatbot in the last 24 hours. Review the context before suspending
          a business.
        </p>
        {data.alerts.length === 0 ? (
          <p>No current threshold alerts.</p>
        ) : (
          data.alerts.map((row) => (
            <p key={String(row.id)}>
              {String(row.name)}: {String(row.requests)} requests ·{" "}
              {String(row.uncertain)} uncertain calls.
            </p>
          ))
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Registered chatbots</h2>
        {data.bots.map((bot) => (
          <article
            key={String(bot.id)}
            className="rounded-2xl border border-border p-4"
          >
            <strong>
              {String(bot.name)} · {String(bot.business || bot.organization_id)}
            </strong>
            <p className="my-2 break-all text-xs">
              ID {String(bot.id)}
              <br />
              Organisation {String(bot.organization_id)}
              <br />
              {JSON.stringify(bot.domains || [])}
            </p>
            <button
              className={button}
              onClick={() =>
                void save("suspend", { id: bot.id, suspended: !bot.suspended })
              }
            >
              {bot.suspended ? "Restore chatbot" : "Suspend chatbot"}
            </button>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-border p-5">
        <h2 className="text-xl font-semibold">Technical errors</h2>
        {data.errors.map((row) => (
          <p key={String(row.id)} className="my-2 break-all text-xs">
            {String(row.created_at)} · bot {String(row.bot_id)} ·{" "}
            {String(row.error_code)}
          </p>
        ))}
      </section>
      <form
        className="space-y-3 rounded-2xl border border-border p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          try {
            setReview(
              await chatbotSupportReview(
                String(f.get("bot")),
                String(f.get("reason")),
              ),
            );
          } catch {
            setMessage(
              "Support review requires an authorized need and chatbot administration permission.",
            );
          }
        }}
      >
        <h2 className="text-xl font-semibold">
          Audited customer support review
        </h2>
        <p className="text-sm">
          Only open private conversations for an authorised support need.
          Ordinary team roles do not have this permission.
        </p>
        <label>
          Chatbot ID
          <input className={field} name="bot" required />
        </label>
        <label>
          Reason and customer-authorised support need
          <textarea
            className={field}
            name="reason"
            required
            minLength={15}
            maxLength={500}
          />
        </label>
        <button className={button}>Review retained messages</button>
        {review.map((row, index) => (
          <p
            key={index}
            className="whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm"
          >
            <b>{String(row.role)}</b> {String(row.content)}
          </p>
        ))}
      </form>
    </main>
  );
}
