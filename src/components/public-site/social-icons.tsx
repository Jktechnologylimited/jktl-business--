/** Small monochrome glyphs for social-link buttons — `currentColor` so they
 * inherit whatever text/icon color surrounds them, same as a lucide icon. */

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M15 8.5h-2c-.83 0-1.5.67-1.5 1.5v2h3.5l-.5 3H11.5v7h-3v-7H6.5v-3H8.5v-2.2C8.5 6.9 10 5.5 12.3 5.5H15v3Z" />
    </svg>
  );
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 4v10.5a3.25 3.25 0 1 1-2.6-3.19" />
      <path d="M14 4c.4 2.2 2.1 3.8 4.3 4v2.2c-1.6 0-3.1-.5-4.3-1.4" />
    </svg>
  );
}

export function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4c2.4 0 4 1.8 4 4.3v2c0 .5.4 1 1.3 1.5.5.3 1.2.5 1.2.9 0 .5-.9.8-1.7 1-.3.1-.5.3-.6.6-.1.4-.2.9-.4 1.1-.3.3-1 .1-1.6.2-.5.1-.8.7-1.9.7s-1.4-.6-1.9-.7c-.6-.1-1.3.1-1.6-.2-.2-.2-.3-.7-.4-1.1-.1-.3-.3-.5-.6-.6-.8-.2-1.7-.5-1.7-1 0-.4.7-.6 1.2-.9.9-.5 1.3-1 1.3-1.5v-2C8 5.8 9.6 4 12 4Z" />
    </svg>
  );
}
