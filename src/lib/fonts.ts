/**
 * Every Google Font this app loads, in one place, so nothing gets imported
 * twice. `next/font/google` self-hosts each one at build time (no runtime
 * request to Google) and exposes it as a CSS custom property via
 * `variable` — it works the same whether imported into a server or a
 * client component, since the actual font-loading happens at build time,
 * not in whatever module imports the result.
 *
 * Two things use this file:
 *  1. The dashboard's own fixed brand (`layout.tsx`) — Cormorant Garamond +
 *     Plus Jakarta Sans + JetBrains Mono, matching business.jktl.com.ng.
 *  2. Seven public-website font *pairings* a business can choose between
 *     (`SITE_FONT_PAIRS` below) — the "classic" pairing deliberately reuses
 *     the exact same Cormorant Garamond / Plus Jakarta Sans objects as the
 *     dashboard, so choosing it doesn't load anything twice.
 */
import {
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
  Baloo_2,
  Quicksand,
  Playfair_Display,
  Poppins,
  Fraunces,
  Work_Sans,
  Bebas_Neue,
  Manrope,
  Space_Grotesk,
  Inter,
} from "next/font/google";

export const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant-garamond", display: "swap" });
export const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta-sans", display: "swap" });
export const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const baloo2 = Baloo_2({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-baloo-2", display: "swap" });
export const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", display: "swap" });

export const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-playfair-display", display: "swap" });
export const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins", display: "swap" });

export const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces", display: "swap" });
export const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans", display: "swap" });

export const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas-neue", display: "swap" });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-space-grotesk", display: "swap" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** Every font `.variable` used anywhere in the site-font system — applied
 * together on the public site's root so all their CSS custom properties are
 * available to reference, regardless of which single pairing is active. */
export const ALL_SITE_FONT_VARIABLES = [
  cormorantGaramond.variable,
  plusJakartaSans.variable,
  baloo2.variable,
  quicksand.variable,
  playfairDisplay.variable,
  poppins.variable,
  fraunces.variable,
  workSans.variable,
  bebasNeue.variable,
  manrope.variable,
  spaceGrotesk.variable,
  inter.variable,
].join(" ");

export interface SiteFontPair {
  id: string;
  label: string;
  /** One-line description shown under the label in the picker — where this
   * pairing sits on the girlie-to-professional spectrum you asked for. */
  vibe: string;
  /** A `var(--font-x)` reference — NOT the `.variable` class name. Applying
   * a font's `.variable` class (see `ALL_SITE_FONT_VARIABLES`) is what
   * *defines* `--font-x`; this is what *reads* it back for the currently
   * chosen pairing. */
  displayVar: string;
  bodyVar: string;
}

/** Seven display+body pairings a business can choose for their public
 * website, spanning playful/feminine to buttoned-up corporate. Order
 * matters for the picker — laid out in that same spectrum. */
export const SITE_FONT_PAIRS: SiteFontPair[] = [
  { id: "playful", label: "Playful", vibe: "Rounded and fun", displayVar: "var(--font-baloo-2)", bodyVar: "var(--font-quicksand)" },
  { id: "romantic", label: "Romantic", vibe: "Soft and feminine", displayVar: "var(--font-playfair-display)", bodyVar: "var(--font-poppins)" },
  { id: "chic", label: "Chic", vibe: "Trendy and editorial", displayVar: "var(--font-fraunces)", bodyVar: "var(--font-work-sans)" },
  { id: "classic", label: "Classic", vibe: "Elegant — matches the JKTL brand", displayVar: "var(--font-cormorant-garamond)", bodyVar: "var(--font-plus-jakarta-sans)" },
  { id: "bold", label: "Bold & Glam", vibe: "Confident and statement-making", displayVar: "var(--font-bebas-neue)", bodyVar: "var(--font-manrope)" },
  { id: "modern", label: "Modern", vibe: "Clean and tech-forward", displayVar: "var(--font-space-grotesk)", bodyVar: "var(--font-inter)" },
  { id: "professional", label: "Professional", vibe: "Plain and corporate", displayVar: "var(--font-inter)", bodyVar: "var(--font-inter)" },
];

export function getSiteFontPair(id: string): SiteFontPair {
  return SITE_FONT_PAIRS.find((p) => p.id === id) ?? SITE_FONT_PAIRS[3]; // "classic"
}
