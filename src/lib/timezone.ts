/** JKTL Business only operates in Nigeria, which is a single fixed UTC+1
 * offset year-round (no DST) — so "yesterday" for the daily-summary cron
 * can be computed with plain offset math instead of pulling in a timezone
 * library for one calculation. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** Returns the UTC instants bounding "yesterday" in Africa/Lagos wall-clock
 * time, as ISO strings — e.g. if it's currently Sept 19th in Lagos, this
 * returns [Sept 18th 00:00 Lagos, Sept 19th 00:00 Lagos) expressed in UTC. */
export function lagosYesterdayRangeUTC(now = new Date()): { start: string; end: string } {
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const lagosTodayMidnightAsUTC = Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate());
  const end = new Date(lagosTodayMidnightAsUTC - LAGOS_OFFSET_MS);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
