// Creates (or resets the password for) a JKTL command-center admin
// account. Deliberately NOT a web signup flow — the command center can see
// every business on the platform, so the only way to create or reset one
// of these accounts is running this from a terminal with database access,
// the same trust boundary as DATABASE_URL itself.
//
// Usage:
//   node scripts/create-admin.mjs "John" "john@jktl.com.ng" "a-strong-password"
// or, equivalently:
//   ADMIN_NAME="John" ADMIN_EMAIL="john@jktl.com.ng" ADMIN_PASSWORD="a-strong-password" node scripts/create-admin.mjs
//
// Safe to re-run for the same email — it resets that admin's name/password
// rather than failing, so this also doubles as "I forgot my command-center
// password."

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";
import bcrypt from "bcryptjs";

const here = path.dirname(fileURLToPath(import.meta.url));

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
  const [argName, argEmail, argPassword] = process.argv.slice(2);
  const name = argName || process.env.ADMIN_NAME;
  const email = (argEmail || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = argPassword || process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-admin.mjs "Full Name" "email@example.com" "password"');
    console.error("(or set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars instead)");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters — this account can see every business on the platform.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env.local or pass it inline.");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO admin_users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id, (xmax = 0) AS inserted`,
      [name, email, passwordHash],
    );
    const row = result.rows[0];
    console.log(row.inserted ? `Created command-center account for ${email}.` : `Updated password for existing command-center account ${email}.`);
    console.log("Sign in at /admin/login on your deployed app.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
