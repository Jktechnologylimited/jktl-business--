import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/client";
import { SOURCES, preparedSourceSql } from "./queries";
import {
  assertSafeNumbers,
  canonicalJson,
  reportPeriod,
  presetPeriod,
  type InvestorReport,
  type Period,
} from "./model";
export type SourceKey = keyof typeof SOURCES;
export function reportDigest(report: InvestorReport) {
  const data = { ...report };
  delete data.id;
  delete data.digest;
  return createHash("sha256").update(canonicalJson(data)).digest("hex");
}
export async function loadInvestorReport(
  period: Period,
  notes = "",
): Promise<InvestorReport> {
  const generatedAt = new Date().toISOString(),
    sql = getSql(),
    params = [period.start, period.end, period.previousStart, generatedAt];
  const tables = [
    ...new Set(Object.values(SOURCES).flatMap((s) => [...s.tables])),
  ];
  const metadata = await sql.query(
    "SELECT name,to_regclass('public.'||name) present FROM unnest($1::text[]) name",
    [tables],
  );
  const present = new Set(
    metadata.filter((r) => r.present).map((r) => String(r.name)),
  );
  const keys = Object.keys(SOURCES) as SourceKey[],
    ready = keys.filter((key) =>
      SOURCES[key].tables.every((t) => present.has(t)),
    );
  let rows: Record<string, unknown>[][] = [];
  try {
    rows = await sql.transaction(
      ready.map((key) =>
        sql.query(preparedSourceSql(SOURCES[key].sql), params),
      ),
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
  } catch {
    throw Error(
      "Could not read a consistent reporting snapshot. Please retry or ask the team to check the reporting sources.",
    );
  }
  const sections: Record<string, unknown> = {};
  for (const key of keys) {
    const index = ready.indexOf(key);
    if (index < 0) {
      sections[key] = {
        available: false,
        reason: "Required source tables are not available.",
      };
      continue;
    }
    const data = rows[index]?.[0]?.data;
    assertSafeNumbers(data);
    if (!data || typeof data !== "object")
      throw Error("Could not read a reporting source.");
    sections[key] = { available: true, data };
  }
  return {
    version: 1,
    generatedAt,
    period,
    notes: notes.trim().slice(0, 1500),
    ...sections,
  } as InvestorReport;
}
export async function reportsInstalled() {
  return Boolean(
    (
      await getSql().query(
        "SELECT to_regclass('public.investor_reports') present",
        [],
      )
    )[0]?.present,
  );
}
export async function listInvestorReports() {
  if (!(await reportsInstalled())) return [];
  return getSql().query(
    "SELECT id,generated_at,from_day,to_day,digest FROM investor_reports ORDER BY generated_at DESC LIMIT 20",
    [],
  );
}
export async function saveInvestorReport(
  actorId: string,
  period: Period,
  notes: string,
) {
  if (!(await reportsInstalled()))
    throw Error(
      "Could not generate a saved report until the reporting migration is installed.",
    );
  if (notes.length > 1500)
    throw Error("Use management notes of 1,500 characters or fewer.");
  const sql = getSql();
  const recent = await sql.query(
    "SELECT count(*)::int n FROM investor_reports WHERE created_by=$1 AND generated_at>now()-interval '5 minutes'",
    [actorId],
  );
  if (Number(recent[0].n) >= 5)
    throw Error(
      "Choose an existing report or wait five minutes before generating another.",
    );
  const report = await loadInvestorReport(period, notes);
  if (
    !report.accounts.available ||
    !report.receipts.available ||
    !report.subscriptions.available
  )
    throw Error(
      "Could not generate the report: required account or payment sources are unavailable.",
    );
  const id = randomUUID(),
    digest = reportDigest(report);
  await sql.query(
    "INSERT INTO investor_reports(id,created_by,generated_at,from_day,to_day,payload,digest) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)",
    [
      id,
      actorId,
      report.generatedAt,
      period.from,
      period.to,
      JSON.stringify(report),
      digest,
    ],
  );
  return { ...report, id, digest };
}
export async function readInvestorReport(id: string) {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return null;
  const row = (
    await getSql().query(
      "SELECT id,payload,digest FROM investor_reports WHERE id=$1",
      [id],
    )
  )[0];
  if (!row) return null;
  const report = row.payload as InvestorReport;
  if (reportDigest(report) !== row.digest)
    throw Error("Could not verify this report snapshot.");
  return { ...report, id: String(row.id), digest: String(row.digest) };
}
export function periodFromQuery(
  query: Record<string, string | string[] | undefined>,
) {
  if (typeof query.range === "string" && query.range !== "custom")
    return presetPeriod(query.range);
  return reportPeriod(
    typeof query.from === "string" ? query.from : undefined,
    typeof query.to === "string" ? query.to : undefined,
  );
}
