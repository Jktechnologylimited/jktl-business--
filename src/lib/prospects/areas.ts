/**
 * Affluent areas to search, per market.
 *
 * "High brow areas" is a prospecting strategy, not a detail: a business in Lekki
 * or Ikoyi is far more likely to pay for a booking system than one on the
 * outskirts, and far more likely to have a website worth critiquing. So the areas
 * are a curated list rather than free text, which also makes the reporting
 * meaningful — "Lekki converted at 4%, Ikeja at 1%" is a decision; a pile of
 * ad-hoc search strings is not.
 *
 * These are the commercial districts and residential neighbourhoods where the
 * money is, per city. Not exhaustive by design: the admin can still type an area
 * manually.
 */

export interface SearchArea {
  market: string;
  city: string;
  area: string;
  /** Why this area: used in the admin list so the choice is legible. */
  note: string;
}

export const AFFLUENT_AREAS: SearchArea[] = [
  // Nigeria — Lagos
  { market: "NG", city: "Lagos", area: "Lekki Phase 1", note: "Highest density of private clinics and aesthetics studios in Lagos" },
  { market: "NG", city: "Lagos", area: "Victoria Island", note: "Corporate and expatriate clientele" },
  { market: "NG", city: "Lagos", area: "Ikoyi", note: "Old-money residential; home-visit and concierge medicine" },
  { market: "NG", city: "Lagos", area: "Banana Island", note: "Ultra-prime; almost entirely referral-driven" },
  { market: "NG", city: "Lagos", area: "Ikeja GRA", note: "Government and business district" },
  { market: "NG", city: "Lagos", area: "Surulere", note: "Dense, cash-rich, low digital adoption" },
  { market: "NG", city: "Lagos", area: "Yaba", note: "Tech-adjacent; younger aesthetics market" },
  // Nigeria — Abuja
  { market: "NG", city: "Abuja", area: "Maitama", note: "Prime ministerial and diplomatic neighbourhood" },
  { market: "NG", city: "Abuja", area: "Asokoro", note: "High-net-worth residential" },
  { market: "NG", city: "Abuja", area: "Wuse 2", note: "Retail and clinic cluster" },
  { market: "NG", city: "Abuja", area: "Katampe Extension", note: "New money, new builds, no established providers" },
  // Nigeria — Port Harcourt / Yenagoa
  { market: "NG", city: "Port Harcourt", area: "Old GRA", note: "Oil-sector clientele" },
  { market: "NG", city: "Port Harcourt", area: "New GRA", note: "Private hospitals and specialists" },
  { market: "NG", city: "Yenagoa", area: "Opolo", note: "State-capital residential core" },
  { market: "NG", city: "Yenagoa", area: "Kpansia", note: "Commercial spine" },

  // Ghana — Accra
  { market: "GH", city: "Accra", area: "Airport Residential Area", note: "Prime Accra; high card and MoMo usage" },
  { market: "GH", city: "Accra", area: "East Legon", note: "New-money residential and private clinics" },
  { market: "GH", city: "Accra", area: "Cantonments", note: "Diplomatic and expatriate" },
  { market: "GH", city: "Accra", area: "Labone", note: "Established professional class" },
  { market: "GH", city: "Accra", area: "Osu", note: "Dense commercial and aesthetics" },
  { market: "GH", city: "Kumasi", area: "Ahodwo", note: "Kumasi's prime residential" },
  { market: "GH", city: "Kumasi", area: "Nhyiaeso", note: "Business and clinic cluster" },
  { market: "GH", city: "Takoradi", area: "Airport Ridge", note: "Oil-sector money" },

  // Côte d'Ivoire — Abidjan
  { market: "CI", city: "Abidjan", area: "Cocody", note: "Prime residential; private clinics and aesthetics" },
  { market: "CI", city: "Abidjan", area: "Plateau", note: "Business district" },
  { market: "CI", city: "Abidjan", area: "Marcory Zone 4", note: "Upscale leisure and hospitality" },
  { market: "CI", city: "Abidjan", area: "Riviera", note: "Growing affluent residential" },
  { market: "CI", city: "Abidjan", area: "Deux Plateaux", note: "Diplomatic and high-income" },
  { market: "CI", city: "Yamoussoukro", area: "Centre", note: "Administrative capital" },

  // Senegal — Dakar
  { market: "SN", city: "Dakar", area: "Almadies", note: "Dakar's prime residential and expatriate core" },
  { market: "SN", city: "Dakar", area: "Ngor", note: "Affluent coastal residential" },
  { market: "SN", city: "Dakar", area: "Plateau", note: "Business and government district" },
  { market: "SN", city: "Dakar", area: "Point E", note: "Professional class; clinics and specialists" },
  { market: "SN", city: "Dakar", area: "Mermoz", note: "Established residential" },
  { market: "SN", city: "Dakar", area: "Ouakam", note: "Growing affluent suburb" },
  { market: "SN", city: "Saly", area: "Station", note: "Tourism and second homes" },
];

export function areasForMarket(market: string): SearchArea[] {
  return AFFLUENT_AREAS.filter((a) => a.market === market.toUpperCase());
}

export function marketCodesWithAreas(): string[] {
  return [...new Set(AFFLUENT_AREAS.map((a) => a.market))];
}

/** The niches worth searching, paired with the areas above. Kept here so the
 * admin can launch the whole matrix without retyping queries. */
export const PROSPECT_QUERIES: Array<{ niche: string; query: string }> = [
  { niche: "mens_health", query: "men's health clinic" },
  { niche: "mens_health", query: "urologist" },
  { niche: "mens_health", query: "fertility clinic" },
  { niche: "aesthetics", query: "aesthetic clinic" },
  { niche: "aesthetics", query: "beauty spa" },
  { niche: "aesthetics", query: "dermatologist" },
  { niche: "aesthetics", query: "skin clinic" },
  { niche: "elderly_care", query: "home care service" },
  { niche: "elderly_care", query: "nursing home" },
  { niche: "elderly_care", query: "physiotherapy clinic" },
];
