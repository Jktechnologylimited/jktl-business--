"use client";
import { useState } from "react";
import Papa from "papaparse";
import { ActionForm } from "@/components/distribution/action-form";
import { recordCompanyCostsAction } from "@/lib/actions/company-finance-actions";
export function CompanyCostImport({ categories }: { categories: string[] }) {
  const [rows, setRows] = useState(""),
    [message, setMessage] = useState("");
  async function read(file: File | undefined) {
    setRows("");
    if (!file) return;
    if (file.size > 200000) {
      setMessage("Use a file smaller than 200 KB.");
      return;
    }
    try {
      const raw = await file.text(),
        data = file.name.toLowerCase().endsWith(".json")
          ? JSON.parse(raw)
          : Papa.parse(raw, { header: true, skipEmptyLines: true }).data;
      if (
        !Array.isArray(data) ||
        !data.length ||
        data.length > 200 ||
        data.some((r) => !categories.includes(String(r.category_id)))
      )
        throw Error();
      setRows(JSON.stringify(data));
      setMessage(`${data.length} rows ready for server validation.`);
    } catch {
      setMessage("Check the file columns, cost categories and row limit.");
    }
  }
  return (
    <div>
      <label className="text-sm">
        Expense file
        <input
          type="file"
          accept=".csv,.json"
          onChange={(e) => void read(e.target.files?.[0])}
          className="mt-2 block max-w-full text-sm"
        />
      </label>
      <p role="status" className="my-3 text-sm">
        {message}
      </p>
      {rows && (
        <ActionForm action={recordCompanyCostsAction}>
          <input type="hidden" name="rows" value={rows} />
          <label className="text-sm">
            <input type="checkbox" required />I reviewed the costs and stable
            supplier references
          </label>
          <button className="ml-3 rounded-lg bg-primary p-3 text-on-primary">
            Import validated costs
          </button>
        </ActionForm>
      )}
    </div>
  );
}
