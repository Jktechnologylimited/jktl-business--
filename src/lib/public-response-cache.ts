/** Display-only public catalogues. Checkout and access decisions never use this cache. */
export function publicResponseCache(seconds = 60) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": `public, s-maxage=${seconds}`,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${seconds}`,
  };
}
export const noResponseCache = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};
