import type { GrowthPermission } from "@/lib/admin-permissions";

export function growthContentPermission(category: unknown): GrowthPermission {
  if (category === "games") return "growth_games";
  if (category === "community") return "growth_community";
  if (["marketing", "social", "landing"].includes(String(category)))
    return "growth_marketing";
  throw Error("Choose a content category");
}

export type GrowthMedia = { id: string; url: string; alt: string };
export type GrowthPreview = {
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  kind: string;
  slug: string;
};

export function growthPublicationPath(kind: string, slug: string) {
  return `https://jktl.com.ng/${kind === "blog" ? "blog" : "releases"}/${slug}`;
}

export function inlineGrowthImage(image: GrowthMedia) {
  const url = new URL(image.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Use a full HTTPS image URL.");
  const alt = image.alt.replace(/[\\\[\]\r\n]/g, " ").trim();
  return `\n\n![${alt}](${url.href.replace(/\(/g, "%28").replace(/\)/g, "%29")})\n`;
}
