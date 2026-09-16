"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { JktlMark } from "@/components/app/logo";
import { useBusinessStore } from "@/lib/store";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useBusinessStore((s) => s.hydrated);
  const authenticated = useBusinessStore((s) => s.authenticated);
  const onboardingComplete = useBusinessStore((s) => s.onboardingComplete);
  const hydrate = useBusinessStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!authenticated) router.replace("/login");
    else if (!onboardingComplete) router.replace("/onboarding");
  }, [hydrated, authenticated, onboardingComplete, router]);

  if (!hydrated || !authenticated || !onboardingComplete) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-primary">
        <JktlMark className="size-14" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
