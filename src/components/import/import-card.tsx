"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/toast";
import { downloadCsv, type ImportError, type ParseResult } from "@/lib/import";

/**
 * One upload flow (customers, services, or products) on the Import data
 * page — download a template, upload it filled in, review what will
 * import, confirm. Generic over the row type `T` so the three sections on
 * that page share this instead of three near-identical components.
 */
export function ImportCard<T>({
  title,
  description,
  templateFilename,
  templateCsv,
  parseCsv,
  rowLabel,
  nameOf,
  onImport,
}: {
  title: string;
  description: string;
  templateFilename: string;
  templateCsv: () => string;
  parseCsv: (text: string) => ParseResult<T>;
  /** Singular label for one row, e.g. "customer" — used in button/result text. */
  rowLabel: string;
  /** Pulls a display name out of a parsed row, for the short preview list. */
  nameOf: (row: T) => string;
  /** Actually creates each row — called once per valid row on confirm. */
  onImport: (row: T) => void;
}) {
  const showToast = useToastStore((s) => s.show);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ParseResult<T> | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setResult(parseCsv(text));
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!result || result.valid.length === 0) return;
    setImporting(true);
    for (const row of result.valid) onImport(row);
    setImporting(false);
    setImported(result.valid.length);
    showToast(`Imported ${result.valid.length} ${rowLabel}${result.valid.length === 1 ? "" : "s"}`);
    setResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-xs text-ink-muted">{description}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => downloadCsv(templateFilename, templateCsv())}>
          <Download className="size-4" /> Download template
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-4" /> Upload filled-in file
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {fileName ? <p className="mt-2 text-xs text-ink-muted">{fileName}</p> : null}

      {result ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface p-3">
          <p className="text-sm text-ink">
            <strong>{result.valid.length}</strong> ready to import
            {result.errors.length > 0 ? <span className="text-danger"> · {result.errors.length} skipped</span> : null}
          </p>
          {result.valid.length > 0 ? (
            <p className="truncate text-xs text-ink-muted">
              {result.valid
                .slice(0, 5)
                .map((r) => nameOf(r))
                .join(", ")}
              {result.valid.length > 5 ? `, +${result.valid.length - 5} more` : ""}
            </p>
          ) : null}
          {result.errors.length > 0 ? <ErrorList errors={result.errors} /> : null}
          <Button type="button" size="sm" className="self-start" disabled={result.valid.length === 0 || importing} onClick={confirmImport}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : null}
            Import {result.valid.length} {rowLabel}
            {result.valid.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}

      {imported !== null ? <p className="mt-2 text-xs text-primary">Imported {imported} {rowLabel}{imported === 1 ? "" : "s"}.</p> : null}
    </section>
  );
}

function ErrorList({ errors }: { errors: ImportError[] }) {
  return (
    <ul className="max-h-24 overflow-y-auto text-xs text-danger">
      {errors.slice(0, 10).map((e, i) => (
        <li key={i}>
          Row {e.row}: {e.message}
        </li>
      ))}
      {errors.length > 10 ? <li>+{errors.length - 10} more</li> : null}
    </ul>
  );
}
