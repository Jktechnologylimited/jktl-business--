import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSubdomainByCustomDomain } from "@/lib/db/public";

/**
 * Two ways a request gets routed to a business's public site, both ending
 * in the same rewrite to /sites/<subdomain>:
 *   1. Wildcard subdomain: businessname.jktl.com.ng — pure string match,
 *      zero extra cost, handled first (this is virtually all traffic).
 *   2. Verified custom domain: www.glamhairstudio.com — a business's own
 *      domain, mapped onto their site (see `src/lib/actions/domain-actions.ts`).
 *      Requires one extra DB lookup, but only for hosts that are neither
 *      *.jktl.com.ng nor localhost — see `isCandidateCustomDomain` — so the
 *      platform's own traffic never pays for this.
 *
 * Everything else (the apex domain, www, app, and plain localhost during
 * development) passes straight through untouched — /login, /business/*,
 * /api/* etc. keep working exactly as before. This only ever rewrites the
 * URL Next.js resolves against; the address bar the visitor sees never
 * changes.
 */

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng").toLowerCase();

// Subdomains that are real, separately-meaningful parts of the platform —
// not a tenant's public site — and so must pass straight through to
// whatever actually lives there instead of being rewritten to /sites/<name>.
// "business" matters most: this app (the dashboard/login/API routes) is
// itself served from business.jktl.com.ng, sharing this same Vercel project
// with the wildcard, so without this it would swallow its own domain.
// RESERVED_APP_SUBDOMAINS lets more be added via an env var (comma-
// separated) without a code change if new fixed subdomains show up later.
const EXTRA_RESERVED = (process.env.RESERVED_APP_SUBDOMAINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const RESERVED_HOSTS = new Set(["www", "app", "api", "business", "admin", "accounts", ROOT_DOMAIN, ...EXTRA_RESERVED]);

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  // Local dev convenience: businessname.localhost:3000
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }

  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = hostname.slice(0, -(`.${ROOT_DOMAIN}`.length));
  // A subdomain with a dot in it (e.g. a stray "a.b.jktl.com.ng") isn't one
  // of ours to rewrite.
  if (!sub || sub.includes(".") || RESERVED_HOSTS.has(sub)) return null;
  return sub;
}

/** A request host is only worth a custom-domain DB lookup when it's
 * neither the platform's own domain (apex, any *.jktl.com.ng subdomain —
 * reserved or tenant) nor a local-dev host. This is what keeps that
 * lookup off the hot path for the platform's own traffic. */
function isCandidateCustomDomain(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  const subdomain = extractSubdomain(host);
  if (subdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  const hostname = host.split(":")[0].toLowerCase();
  if (isCandidateCustomDomain(hostname)) {
    const mappedSubdomain = await getSubdomainByCustomDomain(hostname);
    if (mappedSubdomain) {
      const url = request.nextUrl.clone();
      url.pathname = `/sites/${mappedSubdomain}${request.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - Next.js internals (_next/static, _next/image)
     * - PWA/static files (icons, manifest, favicon)
     */
    "/((?!_next/static|_next/image|favicon.png|apple-touch-icon.png|manifest.webmanifest|icon-.*\\.png|sw.js).*)",
  ],
};
