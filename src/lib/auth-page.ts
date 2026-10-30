import type { Metadata } from "next";
export type AuthQuery = Record<string, string | string[] | undefined>;
/** Server-supplied query values retain the same first-value semantics as useSearchParams. */
export function authSearchParams(query: AuthQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value))
      for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
export function authPageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://business.jktl.com.ng${path}` },
  };
}
