"use client";

import { useState } from "react";
import { Save, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { getPack, packOptions, type PackId } from "@/lib/ai/industry-packs";
import { cn } from "@/lib/utils";
import type { AiReceptionistConfig } from "@/lib/ai/types";
import type { SaveConfigInput } from "@/lib/actions/receptionist-actions";

/**
 * Receptionist settings.
 *
 * The triage-rule preview is not decoration: before switching the agent on, a
 * clinic's medical director has to be able to read, in their own language,
 * exactly which symptoms will stop the bot and send the patient to emergency
 * care. Showing the live rule list — the same data the deterministic screen
 * evaluates — is what makes that review possible without reading code.
 */

const SEVERITY_STYLE: Record<string, string> = {
  emergency: "bg-danger-soft text-danger",
  urgent: "bg-accent-soft text-accent-strong",
  caution: "bg-info-soft text-info",
};

const SEVERITY_LABEL: Record<string, string> = {
  emergency: "Emergency — patient sent to emergency care",
  urgent: "Urgent — same-day clinical review",
  caution: "Caution — flagged for the clinician",
};

export function ReceptionistSettingsForm({
  config,
  demo,
  busy,
  onSave,
  onSimulate,
}: {
  config: AiReceptionistConfig;
  demo: boolean;
  busy: boolean;
  onSave: (input: SaveConfigInput) => void;
  onSimulate: (phone: string) => void;
}) {
  const [form, setForm] = useState<SaveConfigInput>({
    enabled: config.enabled,
    packId: config.packId,
    voiceNumber: config.voiceNumber,
    smsSenderId: config.smsSenderId,
    greeting: config.greeting,
    escalationPhone: config.escalationPhone,
    escalationEmail: config.escalationEmail,
    triageEnabled: config.triageEnabled,
    autoBook: config.autoBook,
    averageConsultValueNaira: Math.round(config.averageConsultValueKobo / 100),
    quietHoursStart: config.quietHoursStart,
    quietHoursEnd: config.quietHoursEnd,
  });
  const [testPhone, setTestPhone] = useState("");

  const pack = getPack(form.packId as PackId);

  function set<K extends keyof SaveConfigInput>(key: K, value: SaveConfigInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-base font-semibold text-ink">Clinical pack</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          The pack decides the assistant&apos;s tone, what it must never say, and which symptoms stop the conversation.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Pack" htmlFor="pack" hint={pack.summary}>
            <Select id="pack" value={form.packId} onChange={(e) => set("packId", e.target.value)}>
              {packOptions().map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Average consultation value (₦)"
            htmlFor="avgValue"
            hint="Used to value a recovered call in the ROI report."
          >
            <Input
              id="avgValue"
              inputMode="numeric"
              value={String(form.averageConsultValueNaira)}
              onChange={(e) => set("averageConsultValueNaira", Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
            />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <ShieldAlert className="size-4 text-danger" /> What stops the assistant
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            Screened on the patient&apos;s message before the AI is involved, so these always behave the same way.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {pack.triageRules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2 text-[13px]">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", SEVERITY_STYLE[rule.severity])}>
                  {rule.severity}
                </span>
                <span className="text-ink">
                  {rule.label}
                  <span className="block text-[11px] text-ink-faint">{SEVERITY_LABEL[rule.severity]}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-base font-semibold text-ink">Line and messages</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Clinic line (the number patients call)" htmlFor="voice" hint="The Twilio number patients call. Buy it from the team, or paste one you already own.">
            <Input id="voice" value={form.voiceNumber} onChange={(e) => set("voiceNumber", e.target.value)} placeholder="0700 000 0000" />
          </Field>
          <Field label="SMS sender ID" htmlFor="sender" hint="An alphanumeric Sender ID (up to 11 characters) where the country allows one, otherwise a Twilio number.">
            <Input id="sender" value={form.smsSenderId} onChange={(e) => set("smsSenderId", e.target.value)} placeholder="JKTL" maxLength={11} />
          </Field>
        </div>

        <div className="mt-3">
          <Field
            label="Custom greeting (optional)"
            htmlFor="greeting"
            hint="Leave empty to use the pack's own greeting. {name} and {business} are replaced."
          >
            <Textarea
              id="greeting"
              rows={2}
              value={form.greeting}
              onChange={(e) => set("greeting", e.target.value)}
              placeholder="Hi{name}, welcome to {business}. How can we help today?"
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Escalation phone" htmlFor="escPhone" hint="Where an urgent chat is handed to a human.">
            <Input id="escPhone" value={form.escalationPhone} onChange={(e) => set("escalationPhone", e.target.value)} placeholder="0803 000 0000" />
          </Field>
          <Field label="Escalation email" htmlFor="escEmail" hint="Backstop if nobody has the app installed.">
            <Input id="escEmail" type="email" value={form.escalationEmail} onChange={(e) => set("escalationEmail", e.target.value)} placeholder="frontdesk@clinic.com" />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Quiet hours start" htmlFor="quietStart" hint="Optional. Callbacks are held back during these hours.">
            <Input id="quietStart" type="time" value={form.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} />
          </Field>
          <Field label="Quiet hours end" htmlFor="quietEnd" hint="West Africa Time (Lagos).">
            <Input id="quietEnd" type="time" value={form.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-base font-semibold text-ink">Switches</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Switch
            id="enabled"
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            label="Answer missed calls"
            hint="Off records the calls without sending anything — useful for seeing how many you are missing first."
          />
          <Switch
            id="triage"
            checked={form.triageEnabled}
            onChange={(v) => set("triageEnabled", v)}
            label="Clinical triage screening"
            hint="Strongly recommended. Without it, red flags are left to the language model."
          />
          <Switch
            id="autoBook"
            checked={form.autoBook}
            onChange={(v) => set("autoBook", v)}
            label="Let the assistant write bookings"
            hint="Off means it collects the details and asks a person to confirm."
          />
        </div>

        {!form.triageEnabled ? (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-ink">
            <strong className="font-semibold text-danger">Triage is off.</strong> Emergencies would then depend on the model noticing them. We
            recommend leaving this on.
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck className="size-3.5 text-primary" /> Triage runs before the model on every message.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-base font-semibold text-ink">Test it</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Runs the real pipeline — a real message to this number, charged to the wallet — so you can see the whole chain work before pointing
          your live line at it.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Your mobile number"
            className="h-10"
            aria-label="Test phone number"
          />
          <Button size="sm" variant="outline" className="h-10" disabled={busy || !testPhone.trim()} onClick={() => onSimulate(testPhone)}>
            Send a test callback
          </Button>
        </div>
        {demo ? <p className="mt-2 text-[11px] text-ink-muted">Demo mode sends nothing.</p> : null}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button disabled={busy} onClick={() => onSave(form)}>
          <Save className="size-4" /> Save settings
        </Button>
      </div>
    </div>
  );
}

function Switch({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-border-strong accent-primary"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
    </label>
  );
}
