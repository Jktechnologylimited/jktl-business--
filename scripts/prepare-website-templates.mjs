/** Apply additive platform migrations, using the deployment's existing DB binding. */
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
      "047_growth_gaming_staff.sql",
      "048_team_growth_role.sql",
      "049_email_branding.sql",
      "050_distribution_completion.sql",
      "051_affiliate_operations.sql",
      "052_affiliate_materials.sql",
      "053_affiliate_campaigns.sql",
      "054_distribution_product_rules.sql",
      "055_editorial_team.sql",
      "056_domain_discovery.sql",
      "057_registrar_operations.sql",
      "058_go54_diagnostics.sql",
      "059_domain_fulfillment.sql",
      "060_email_management.sql",
      "061_email_promotional_footer.sql",
      "062_custom_client_integrations.sql",
      "063_custom_site_content.sql",
      "064_managed_client_editor.sql",
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
    `Platform schema: ${migrations.length} additive migration batches applied.`,
  );
}
