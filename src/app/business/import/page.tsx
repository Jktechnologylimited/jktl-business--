"use client";

import { PageHeader } from "@/components/app/page-header";
import { ImportCard } from "@/components/import/import-card";
import { useBusinessStore } from "@/lib/store";
import {
  customerTemplateCsv,
  parseCustomerCsv,
  serviceTemplateCsv,
  parseServiceCsv,
  productTemplateCsv,
  parseProductCsv,
} from "@/lib/import";

/**
 * Bring customers, services and products in from a spreadsheet — for a
 * business switching from paper records, Excel, or another app, rather
 * than re-typing everything by hand. Each section downloads a CSV
 * template with the exact columns expected, and imports through the same
 * store actions (addCustomer/addService/addProduct) every other "add"
 * form in the app already uses, so imported records behave identically
 * to hand-entered ones — same offline-first sync, same validation.
 */
export default function ImportDataPage() {
  const addCustomer = useBusinessStore((s) => s.addCustomer);
  const addService = useBusinessStore((s) => s.addService);
  const addProduct = useBusinessStore((s) => s.addProduct);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Import data" />
      <p className="-mt-2 text-sm text-ink-muted">
        Download a template, fill it in with your existing records, then upload it here. Works from Excel, Google Sheets, or an export
        from wherever your data lives now.
      </p>

      <ImportCard
        title="Customers"
        description="Names, phone numbers, emails — the list that's most painful to re-type by hand."
        templateFilename="jktl-customers-template.csv"
        templateCsv={customerTemplateCsv}
        parseCsv={parseCustomerCsv}
        rowLabel="customer"
        nameOf={(c) => c.name}
        onImport={addCustomer}
      />

      <ImportCard
        title="Services"
        description="Your bookable services and prices."
        templateFilename="jktl-services-template.csv"
        templateCsv={serviceTemplateCsv}
        parseCsv={parseServiceCsv}
        rowLabel="service"
        nameOf={(s) => s.name}
        onImport={addService}
      />

      <ImportCard
        title="Products"
        description="Your retail and stock items, with cost, price and current stock levels."
        templateFilename="jktl-products-template.csv"
        templateCsv={productTemplateCsv}
        parseCsv={parseProductCsv}
        rowLabel="product"
        nameOf={(p) => p.name}
        onImport={addProduct}
      />
    </div>
  );
}
