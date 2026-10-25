import { Suspense } from "react";
import { CustomerSupport } from "@/components/support/customer-support";
import { HelpLibrary } from "@/components/support/help-library";
export default function HelpPage() {
  return (
    <div className="space-y-12">
      <Suspense fallback={<p>Loading help…</p>}>
        <CustomerSupport />
      </Suspense>
      <HelpLibrary />
      <a
        className="inline-block text-sm text-primary underline"
        href="https://wa.me/2347036580994?text=Hi%20JKTL%20Business%2C%20I%20need%20help%20with%20my%20account."
        target="_blank"
        rel="noopener noreferrer"
      >
        Contact the team on WhatsApp →
      </a>
    </div>
  );
}
