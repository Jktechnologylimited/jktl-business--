import Papa from "papaparse";
import { nairaToKobo } from "@/lib/format";
import type { NewCustomerInput, NewServiceInput, NewProductInput } from "@/lib/store";

/**
 * CSV templates + parsing for Settings > Import data
 * (src/app/business/import). One businesses coming from a spreadsheet, a
 * competitor's export, or just paper records can fill in and upload,
 * rather than re-typing every customer and catalogue item by hand.
 *
 * Deliberately template-based, not free-form column mapping: a business
 * downloads our exact headers, fills them in, uploads the same file back.
 * Money columns are in naira (not kobo) since that's what a person can
 * actually type — converted with `nairaToKobo` at parse time, same
 * conversion every form in this app already does.
 */

export type ImportKind = "customers" | "services" | "products";

export interface ImportError {
  row: number; // 1-based, counting the header row as row 0 — matches what a person sees if they open the file in Excel/Sheets.
  message: string;
}

export interface ParseResult<T> {
  valid: T[];
  errors: ImportError[];
}

function parseCsvText(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return result.data;
}

function cell(row: Record<string, string>, key: string): string {
  return (row[key] ?? "").trim();
}

function parseNumber(value: string, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (["yes", "y", "true", "1", "active"].includes(v)) return true;
  if (["no", "n", "false", "0", "inactive"].includes(v)) return false;
  return fallback;
}

// ---- Customers ----

export const CUSTOMER_TEMPLATE_HEADERS = ["Name", "Phone", "Email", "Gender", "Notes"];
const CUSTOMER_TEMPLATE_EXAMPLE = ["Amaka Johnson", "0805 234 1011", "amaka@example.com", "female", "Prefers Saturday appointments"];

export function customerTemplateCsv(): string {
  return Papa.unparse({ fields: CUSTOMER_TEMPLATE_HEADERS, data: [CUSTOMER_TEMPLATE_EXAMPLE] });
}

export function parseCustomerCsv(text: string): ParseResult<NewCustomerInput> {
  const rows = parseCsvText(text);
  const valid: NewCustomerInput[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, i) => {
    const name = cell(row, "Name");
    if (!name) {
      errors.push({ row: i + 1, message: "Missing name — skipped." });
      return;
    }
    const genderRaw = cell(row, "Gender").toLowerCase();
    const gender: NewCustomerInput["gender"] = genderRaw === "male" || genderRaw === "female" || genderRaw === "other" ? genderRaw : "";
    valid.push({ name, phone: cell(row, "Phone"), email: cell(row, "Email"), gender, notes: cell(row, "Notes") });
  });

  return { valid, errors };
}

// ---- Services ----

export const SERVICE_TEMPLATE_HEADERS = ["Name", "Category", "Price (Naira)", "Duration (minutes)", "Description", "Active"];
const SERVICE_TEMPLATE_EXAMPLE = ["Full sew-in install", "Install", "25000", "120", "Includes wash and blow-dry", "yes"];

export function serviceTemplateCsv(): string {
  return Papa.unparse({ fields: SERVICE_TEMPLATE_HEADERS, data: [SERVICE_TEMPLATE_EXAMPLE] });
}

export function parseServiceCsv(text: string): ParseResult<NewServiceInput> {
  const rows = parseCsvText(text);
  const valid: NewServiceInput[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, i) => {
    const name = cell(row, "Name");
    if (!name) {
      errors.push({ row: i + 1, message: "Missing name — skipped." });
      return;
    }
    const priceNaira = parseNumber(cell(row, "Price (Naira)"), NaN);
    if (!Number.isFinite(priceNaira) || priceNaira < 0) {
      errors.push({ row: i + 1, message: `"${name}" has no valid price — skipped.` });
      return;
    }
    valid.push({
      name,
      category: cell(row, "Category"),
      priceKobo: nairaToKobo(priceNaira),
      durationMin: parseNumber(cell(row, "Duration (minutes)"), 30),
      description: cell(row, "Description"),
      active: parseBool(cell(row, "Active"), true),
      imageUrl: null,
    });
  });

  return { valid, errors };
}

// ---- Products ----

export const PRODUCT_TEMPLATE_HEADERS = [
  "Name",
  "SKU",
  "Category",
  "Cost (Naira)",
  "Price (Naira)",
  "Stock quantity",
  "Low stock threshold",
  "Supplier",
  "Active",
];
const PRODUCT_TEMPLATE_EXAMPLE = ["Argan Oil Shampoo 500ml", "SH-001", "Hair", "1500", "3000", "24", "5", "Beauty Supplies Ltd", "yes"];

export function productTemplateCsv(): string {
  return Papa.unparse({ fields: PRODUCT_TEMPLATE_HEADERS, data: [PRODUCT_TEMPLATE_EXAMPLE] });
}

export function parseProductCsv(text: string): ParseResult<NewProductInput> {
  const rows = parseCsvText(text);
  const valid: NewProductInput[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, i) => {
    const name = cell(row, "Name");
    if (!name) {
      errors.push({ row: i + 1, message: "Missing name — skipped." });
      return;
    }
    const priceNaira = parseNumber(cell(row, "Price (Naira)"), NaN);
    if (!Number.isFinite(priceNaira) || priceNaira < 0) {
      errors.push({ row: i + 1, message: `"${name}" has no valid price — skipped.` });
      return;
    }
    valid.push({
      name,
      sku: cell(row, "SKU"),
      category: cell(row, "Category"),
      costKobo: nairaToKobo(parseNumber(cell(row, "Cost (Naira)"), 0)),
      priceKobo: nairaToKobo(priceNaira),
      stockQty: Math.max(0, Math.round(parseNumber(cell(row, "Stock quantity"), 0))),
      lowStockThreshold: Math.max(0, Math.round(parseNumber(cell(row, "Low stock threshold"), 5))),
      supplier: cell(row, "Supplier"),
      active: parseBool(cell(row, "Active"), true),
      imageUrl: null,
    });
  });

  return { valid, errors };
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
