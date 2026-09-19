// Runs every migrations/*.sql file, in filename order, against DATABASE_URL.
// No migration framework — this is deliberately the whole thing.
//
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs
// (or just `npm run db:migrate` once .env.local has DATABASE_URL set)

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

// Plain `node script.mjs` doesn't get Next.js's automatic .env.local
// loading — that only happens inside `next dev`/`next build`. Load it
// ourselves so `npm run db:migrate` doesn't need anything extra.
function loadEnvLocal() {
  const envPath = path.join(here, "..", ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env.local or pass it inline.");
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found in migrations/.");
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Applying ${file} ...`);
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    }
    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  // `err.message` alone doesn't say which table/index/constraint a
  // Postgres error came from — the exact detail that would have made the
  // "index row requires N bytes" bug immediately attributable instead of
  // needing to read every migration file by hand. `pg` attaches these
  // extra fields to the error object when Postgres provides them; print
  // whichever are present.
  for (const field of ["detail", "table", "column", "constraint", "schema", "code"]) {
    if (err[field]) console.error(`  ${field}: ${err[field]}`);
  }
  process.exit(1);
});
