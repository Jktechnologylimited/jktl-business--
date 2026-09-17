import { neon } from "@neondatabase/serverless";

type SqlFn = ReturnType<typeof neon<false, false>>;

let cached: SqlFn | null = null;

/**
 * Returns the Neon tagged-template query function, e.g.
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM customers WHERE organization_id = ${orgId}`;
 *
 * Lazy on purpose: constructing this at module scope would make `next build`
 * fail if DATABASE_URL isn't set at build time, even though nothing here
 * needs the database until a request actually comes in.
 */
export function getSql(): SqlFn {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (see .env.example) with your Neon connection string.",
      );
    }
    cached = neon(url);
  }
  return cached;
}
