/** Apply only the additive template migration, using the deployment's existing DB binding. */
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) {
  console.log(
    "Website template schema: skipped (no DATABASE_URL; demo/gallery build only).",
  );
} else {
  const migration = await readFile(
    new URL("../migrations/029_website_templates.sql", import.meta.url),
    "utf8",
  );
  const statements = migration
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean);
  const sql = neon(url);
  await sql.transaction(
    statements.map((statement) => sql.query(statement, [])),
  );
  console.log("Website template schema: additive migration 029 applied.");
}
