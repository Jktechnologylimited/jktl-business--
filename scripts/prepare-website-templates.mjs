/** Apply only the additive template migration, using the deployment's existing DB binding. */
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) {
  console.log(
    "Website template schema: skipped (no DATABASE_URL; demo/gallery build only).",
  );
} else {
  const migrations = await Promise.all(
    ["029_website_templates.sql", "030_website_metrics.sql", "031_website_plan_billing.sql", "032_tycoon_saves.sql"].map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    ),
  );
  const migration = migrations.join("\n");
  const statements = migration
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean);
  const sql = neon(url);
  await sql.transaction(
    statements.map((statement) => sql.query(statement, [])),
  );
  await sql.query(
    "DELETE FROM website_metric_rate_limits WHERE expires_at < now()",
    [],
  );
  console.log(
    "Website template schema: additive migrations 029, 030, 031 and 032 applied.",
  );
}
