import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Wildcard-subdomain routing for published business sites:
 * businessname.jktl.com.ng -> internally rewritten to /sites/businessname.
 *
 * Everything else (the apex domain, www, app, and plain localhost during
 * development) passes straight through untouched — /login, /business/*,
 * /api/* etc. keep working exactly as before. This only ever rewrites the
 * URL Next.js resolves against; the address bar the visitor sees never
 * changes.
 */

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng").toLowerCase();
const RESERVED_HOSTS = new Set(["www", "app", "api", ROOT_DOMAIN]);

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

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const subdomain = extractSubdomain(host);
  if (!subdomain) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
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
