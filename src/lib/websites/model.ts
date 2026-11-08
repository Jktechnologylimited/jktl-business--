import { subdomainFormatError } from "@/lib/subdomain";
export type WebsiteCard = {
  id: string;
  kind: "primary" | "template" | "custom";
  name: string;
  subdomain: string;
  published: boolean;
  templateId: string;
  url: string;
  editUrl: string;
  revision: number;
};
export function addressSuggestions(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 22)
      .replace(/-$/, "") || "business";
  return [
    ...new Set([
      base,
      ...["online", "ng", "hq", "shop", "studio", "web"].map(
        (s) => base + "-" + s,
      ),
      ...Array.from({ length: 8 }, (_, i) => base + "-" + (i + 2)),
    ]),
  ].filter((s) => !subdomainFormatError(s));
}
export function websiteUrl(slug: string) {
  return `https://${slug}.jktl.com.ng`;
}
export function externalWebsiteUrl(raw: unknown) {
  try {
    const u = new URL(String(raw));
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.toString()
      : "";
  } catch {
    return "";
  }
}
