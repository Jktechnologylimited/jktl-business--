/** The 7 curated accent-color choices a business can pick for their public
 * website (replacing the old free-form hex input) — each tuned to have
 * decent contrast against both white and near-black text, which
 * `textOnColor` (src/lib/contact.ts) picks between at render time. */
export interface AccentColor {
  id: string;
  label: string;
  hex: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: "emerald", label: "Emerald", hex: "#0f6e5c" },
  { id: "rose", label: "Rose", hex: "#c2255c" },
  { id: "red", label: "Red", hex: "#c0392b" },
  { id: "blue", label: "Blue", hex: "#1d4ed8" },
  { id: "purple", label: "Purple", hex: "#7c3aed" },
  { id: "gold", label: "Gold", hex: "#b7791f" },
  { id: "teal", label: "Teal", hex: "#0f7a8c" },
];

export function getAccentColor(hex: string): AccentColor {
  return ACCENT_COLORS.find((c) => c.hex.toLowerCase() === hex?.toLowerCase()) ?? ACCENT_COLORS[0];
}
