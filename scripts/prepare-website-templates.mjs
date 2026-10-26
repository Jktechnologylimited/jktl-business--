/** Apply only the additive template migration, using the deployment's existing DB binding. */
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { applyMigrationBatch } from "./sql-statements.mjs";
const url = process.env.DATABASE_URL;
if (!url) {
  console.log(
    "Website template schema: skipped (no DATABASE_URL; demo/gallery build only).",
  );
} else {
  const migrations = await Promise.all(
    [
      "029_website_templates.sql",
      "030_website_metrics.sql",
      "031_website_plan_billing.sql",
      "032_tycoon_saves.sql",
      "033_editorial.sql",
      "034_domain_orders.sql",
      "035_custom_projects.sql",
      "036_email_features_partners.sql",
      "037_support_reviews.sql",
      "038_distribution_policies.sql",
      "039_distribution_clients.sql",
      "040_partner_workspace.sql",
      "041_partner_operations.sql",
      "042_distribution_finance.sql",
      "043_distribution_operations.sql",
      "044_partner_product_requests.sql",
      "045_distribution_referrals.sql",
      "046_distribution_multi_role.sql",
    ].map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    ),
  );
  const sql = neon(url);
  await applyMigrationBatch(sql, migrations);
  await sql.query(
    "DELETE FROM website_metric_rate_limits WHERE expires_at < now()",
    [],
  );
  console.log(
    "Website template schema: additive migrations 029, 030, 031, 032, 033, 034, 035, 036, 037, 038, 039, 040, 041, 042, 043, 044, 045 and 046 applied.",
  );
}
