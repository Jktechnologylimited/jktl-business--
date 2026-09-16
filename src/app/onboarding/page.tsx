"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import { ServiceForm } from "@/components/services/service-form";
import { useBusinessStore } from "@/lib/store";
import { BUSINESS_TYPE_OPTIONS, getIndustry } from "@/lib/industry";
import { cn } from "@/lib/utils";
import type { BusinessType } from "@/lib/types";

const STEPS = ["Business type", "Business details", "First service", "Finish"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const profile = useBusinessStore((s) => s.data.profile);
  const addService = useBusinessStore((s) => s.addService);
  const completeOnboarding = useBusinessStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType>(profile.businessType);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.city);
  const [state, setState] = useState(profile.state);
  const [addedService, setAddedService] = useState(false);

  const industry = getIndustry(businessType);

  function finish() {
    completeOnboarding(businessType, displayName);
    router.push("/business");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="flex items-center gap-2">
        <JktlMark className="size-8" />
        <span className="font-display text-sm font-semibold text-ink">Set up your business</span>
      </div>

      <ol className="mt-6 flex gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-surface-strong")} />
        ))}
      </ol>

      {step === 0 ? (
        <div className="mt-8 flex-1">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">What kind of business is this?</h1>
          <p className="mt-1.5 text-sm text-ink-muted">This sets up the right modules and terms for you.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {BUSINESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBusinessType(opt.id)}
                className={cn(
                  "rounded-2xl border p-3.5 text-left transition-colors",
                  businessType === opt.id ? "border-primary bg-primary-soft" : "border-border-strong hover:bg-surface",
                )}
              >
                <div className="text-sm font-semibold text-ink">{opt.label}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-8 flex-1">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Tell us about {industry.label.toLowerCase()}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">You can change this anytime in Settings.</p>
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Business name" htmlFor="displayName">
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" htmlFor="city">
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
              </Field>
              <Field label="State" htmlFor="state">
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} required />
              </Field>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 flex-1">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Add your first {industry.catalogLabel.toLowerCase().replace(/s$/, "")}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {industry.productName} already comes with sample {industry.catalogLabel.toLowerCase()} so you can see how
            it works — add one of your own now, or skip and do it later from the menu.
          </p>
          {addedService ? (
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary-strong">
              <Check className="size-4" /> Added — you can add more anytime from Services.
            </div>
          ) : (
            <div className="mt-6">
              <ServiceForm
                categories={industry.serviceCategories}
                cancelLabel="Skip for now"
                onCancel={() => setStep(3)}
                onSubmit={(input) => {
                  addService(input);
                  setAddedService(true);
                }}
              />
            </div>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
            <Check className="size-7" />
          </div>
          <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-ink">You&apos;re all set, {displayName || "there"}</h1>
          <p className="mt-2 max-w-xs text-sm text-ink-muted">
            {industry.productName} is ready with sample {industry.bookingLabelPlural.toLowerCase()}, customers and
            {" "}{industry.catalogLabel.toLowerCase()} so you can see it in action. Add more anytime from the menu.
          </p>
        </div>
      ) : null}

      {!(step === 2 && !addedService) ? (
        <div className="mt-8 flex gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button type="button" className="flex-1" onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button type="button" className="flex-1" onClick={finish}>
              Go to dashboard
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
