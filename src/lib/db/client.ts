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

/**
 * Whether an error means the database is out of date rather than broken.
 *
 * The first thing that happens to anybody who points this app at a fresh or
 * half-migrated database is a raw `relation "…" does not exist` in the terminal
 * and a generic "couldn't load" in the UI — which looks like a bug in the app
 * rather than a missing command. It is by far the most common first-run failure,
 * and it will happen again on every deploy that adds a migration.
 *
 * Postgres codes:
 *   42P01 — undefined_table
 *   42703 — undefined_column
 *   42883 — undefined_function (a migration adding one)
 *   42P07 — duplicate_table (partially applied, needs re-running)
 */
export function isSchemaOutOfDateError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703" || code === "42883" || code === "42P07";
}

/**
 * The message to show a human when the schema is behind.
 *
 * One sentence, and it names the command — because the person reading it is
 * usually mid-setup and wants to know what to type, not what a relation is.
 */
export const SCHEMA_OUT_OF_DATE_MESSAGE =
  "Your database is missing recent tables. Run `npm run db:migrate` to bring it up to date, then reload this page.";
