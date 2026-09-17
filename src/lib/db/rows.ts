/** Postgres BIGINT comes back as a string from both `pg` and the Neon driver
 * to avoid silent precision loss; kobo amounts always fit safely in a JS
 * number, so convert deliberately at the boundary rather than everywhere. */
export function kobo(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
