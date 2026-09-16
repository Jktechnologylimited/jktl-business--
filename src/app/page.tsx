"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusinessStore } from "@/lib/store";
import { JktlMark } from "@/components/app/logo";

export default function RootPage() {
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
    else router.replace("/business");
  }, [hydrated, authenticated, onboardingComplete, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-primary">
      <JktlMark className="size-16" />
      <div className="font-display text-sm font-medium tracking-wide text-white/80">JKTL Business</div>
    </div>
  );
}
