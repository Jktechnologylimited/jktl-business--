import Link from "next/link";
import { JktlMark } from "@/components/app/logo";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="border-b border-border bg-paper">
        <nav
          aria-label="Help centre navigation"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5"
        >
          <Link href="/help" className="flex items-center gap-3 font-semibold">
            <JktlMark className="size-9" />
            JKTL Help Centre
          </Link>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link href="https://jktl.com.ng">Main website</Link>
            <Link href="/login" className="text-blue-600 underline">
              Business sign in
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-6xl border-t border-border px-5 py-7 text-sm text-ink-muted">
        JK Technology Limited ·{" "}
        <Link
          href="https://jktl.com.ng/contact"
          className="text-blue-600 underline"
        >
          Contact JKTL
        </Link>
      </footer>
    </div>
  );
}
