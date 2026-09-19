"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toggle } from "@/components/ui/toggle";
import { StatusPill } from "@/components/app/status-pill";
import { MemberForm } from "@/components/settings/member-form";
import { AccountForm } from "@/components/settings/account-form";
import { BusinessForm } from "@/components/settings/business-form";
import { PasswordForm } from "@/components/settings/password-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { BillingPanel } from "@/components/settings/billing-panel";
import { StorageUsagePanel } from "@/components/settings/storage-usage-panel";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { UpgradeSheet } from "@/components/settings/upgrade-sheet";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { initials } from "@/lib/format";
import { FREE_TEAM_SEATS } from "@/lib/billing";
import type { OrganizationMember } from "@/lib/types";

type Tab = "business" | "users" | "account" | "infrastructure";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const profile = useBusinessStore((s) => s.data.profile);
  const infra = useBusinessStore((s) => s.data.infrastructure);
  const mode = useBusinessStore((s) => s.mode);
  const user = useBusinessStore((s) => s.data.user);
  const members = useBusinessStore((s) => s.data.members);
  const addMember = useBusinessStore((s) => s.addMember);
  const removeMember = useBusinessStore((s) => s.removeMember);
  const updateAccount = useBusinessStore((s) => s.updateAccount);
  const updateBusinessProfile = useBusinessStore((s) => s.updateBusinessProfile);
  const setAvatar = useBusinessStore((s) => s.setAvatar);
  const notificationPrefs = useBusinessStore((s) => s.notificationPrefs);
  const setNotificationPref = useBusinessStore((s) => s.setNotificationPref);
  const showToast = useToastStore((s) => s.show);

  // Paystack redirects back to this page after checkout with
  // ?billing=callback — land straight on the Plan tab so the person sees
  // the confirmation rather than the Business tab they started from. Read
  // via a lazy initializer (computed once for the initial render) rather
  // than an effect, since this is a one-time check of the URL at mount,
  // not something that needs to re-run when other state changes.
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && window.location.search.includes("billing=callback") ? "infrastructure" : "business",
  );
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<OrganizationMember | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Free tier covers just the owner (demo mode has no real billing, so it
  // always allows adding members freely). The authoritative check is
  // server-side in `addMemberAction` — this is just so most people never
  // hit the "discarded" round trip for a mutation that queues offline-first.
  const canAddMember = mode !== "live" || members.length < FREE_TEAM_SEATS || infra.subscriptionStatus === "active";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" />

      <FilterTabs<Tab>
        options={[
          { value: "business", label: "Business" },
          { value: "users", label: "Users" },
          { value: "account", label: "Account" },
          { value: "infrastructure", label: "Plan" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "business" ? (
        <section className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink">Business</h2>
            <button className="text-sm font-medium text-primary" onClick={() => setEditingBusiness(true)}>
              Edit
            </button>
          </div>
          <dl className="mt-2 divide-y divide-border">
            <Row label="Name" value={profile.displayName} />
            <Row label="Type" value={profile.businessType[0].toUpperCase() + profile.businessType.slice(1)} />
            <Row label="Phone" value={profile.phone || "—"} />
            <Row label="Email" value={profile.email || "—"} />
            <Row label="Address" value={profile.address ? `${profile.address}, ${profile.city}, ${profile.state}` : "—"} />
          </dl>
          <p className="mt-3 text-xs text-ink-muted">Business type and logo upload are set at signup and aren&apos;t editable here yet.</p>
        </section>
      ) : null}

      {tab === "users" ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-ink">Team members</h2>
            <Button size="sm" onClick={() => (canAddMember ? setAddingMember(true) : setUpgrading(true))}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          {!canAddMember ? (
            <p className="mb-3 text-xs text-ink-muted">
              The free plan covers just you —{" "}
              <button type="button" onClick={() => setUpgrading(true)} className="font-medium text-primary">
                upgrade
              </button>{" "}
              to add more team members.
            </p>
          ) : null}
          <div className="divide-y divide-border rounded-2xl border border-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                  {initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                  <div className="truncate text-xs text-ink-muted">{m.title}</div>
                </div>
                <StatusPill tone={m.role === "owner" ? "primary" : "neutral"}>
                  {m.role[0].toUpperCase() + m.role.slice(1)}
                </StatusPill>
                {m.role !== "owner" ? (
                  <button
                    onClick={() => setRemovingMember(m)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "account" ? (
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">Profile</h2>
              <button className="text-sm font-medium text-primary" onClick={() => setEditingAccount(true)}>
                Edit
              </button>
            </div>
            <div className="mt-3">
              <AvatarUpload name={user.name} src={user.avatarUrl} onChange={setAvatar} />
            </div>
            <dl className="mt-4 divide-y divide-border border-t border-border pt-1">
              <Row label="Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Phone" value={user.phone} />
            </dl>
          </section>

          <section className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">Password</h2>
              <button className="text-sm font-medium text-primary" onClick={() => setChangingPassword(true)}>
                Change
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">••••••••</p>
          </section>

          <section className="rounded-2xl border border-border p-4">
            <h2 className="font-display text-sm font-semibold text-ink">Appearance</h2>
            <p className="mt-1 mb-3 text-xs text-ink-muted">&ldquo;System&rdquo; follows your device&apos;s light/dark setting automatically.</p>
            <ThemeToggle />
          </section>

          <section className="rounded-2xl border border-border p-4">
            <h2 className="font-display text-sm font-semibold text-ink">Notifications</h2>
            <div className="mt-1 divide-y divide-border">
              <Toggle
                label="Booking reminders"
                description="Notify me ahead of upcoming bookings"
                checked={notificationPrefs.bookingReminders}
                onChange={(v) => setNotificationPref("bookingReminders", v)}
              />
              <Toggle
                label="Low-stock alerts"
                description="Notify me when a product hits its threshold"
                checked={notificationPrefs.lowStockAlerts}
                onChange={(v) => setNotificationPref("lowStockAlerts", v)}
              />
              <Toggle
                label="Daily summary email"
                description="A morning recap of yesterday's numbers"
                checked={notificationPrefs.dailySummaryEmail}
                onChange={(v) => setNotificationPref("dailySummaryEmail", v)}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">Actual emails send once Resend is connected in Phase 2.</p>
          </section>
        </div>
      ) : null}

      {tab === "infrastructure" ? (
        <div className="flex flex-col gap-4">
          <BillingPanel infra={infra} mode={mode} />
          <StorageUsagePanel mode={mode} />
          <section className="rounded-2xl border border-border p-4">
            <h2 className="font-display text-sm font-semibold text-ink">Infrastructure status</h2>
            <dl className="mt-2 divide-y divide-border">
              <Row label="Database" value="Active" />
              <Row label="Hosting" value="Active" />
              <Row label="SSL" value="Active" />
              <Row label="Business address" value={infra.domain || "—"} />
            </dl>
          </section>
        </div>
      ) : null}

      <Sheet open={addingMember} onClose={() => setAddingMember(false)} title="Add team member">
        <MemberForm
          onCancel={() => setAddingMember(false)}
          onSubmit={(input) => {
            addMember(input);
            setAddingMember(false);
            showToast(`${input.name} added to the team`);
          }}
        />
      </Sheet>

      <Sheet open={editingBusiness} onClose={() => setEditingBusiness(false)} title="Edit business">
        <BusinessForm
          initial={profile}
          onCancel={() => setEditingBusiness(false)}
          onSubmit={(patch) => {
            updateBusinessProfile(patch);
            setEditingBusiness(false);
            showToast("Business details updated");
          }}
        />
      </Sheet>

      <Sheet open={editingAccount} onClose={() => setEditingAccount(false)} title="Edit profile">
        <AccountForm
          initial={user}
          onCancel={() => setEditingAccount(false)}
          onSubmit={(patch) => {
            updateAccount(patch);
            setEditingAccount(false);
            showToast("Profile updated");
          }}
        />
      </Sheet>

      <Sheet open={changingPassword} onClose={() => setChangingPassword(false)} title="Change password">
        <PasswordForm
          onCancel={() => setChangingPassword(false)}
          onSubmit={() => {
            setChangingPassword(false);
            showToast("Password updated");
          }}
        />
      </Sheet>

      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        reason="Add more team members to your account — the free plan covers just the owner."
        mode={mode}
      />

      <ConfirmDialog
        open={!!removingMember}
        title={`Remove ${removingMember?.name}?`}
        description="They'll lose access to JKTL Business immediately."
        onCancel={() => setRemovingMember(null)}
        onConfirm={() => {
          if (removingMember) {
            removeMember(removingMember.id);
            showToast("Team member removed");
          }
          setRemovingMember(null);
        }}
      />
    </div>
  );
}
