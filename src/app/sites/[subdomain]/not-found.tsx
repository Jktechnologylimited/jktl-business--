export default function UnavailableWebsite() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink">
      <h1 className="font-display text-xl font-semibold">This site isn&apos;t available</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        It may not be published yet, or the address is incorrect. If this is your
        business, sign in to JKTL Business and publish your site from Website settings.
      </p>
      <a className="mt-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white" href="https://business.jktl.com.ng/login">
        Sign in to manage your website
      </a>
    </div>
  );
}
