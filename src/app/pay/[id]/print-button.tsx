"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Save as PDF" without building a PDF pipeline.
 *
 * The page already carries print styles, so the browser's own print dialog is
 * the right tool: the customer gets a clean document they can file or email on
 * to their accountant, and nothing has to be generated, stored or kept in sync
 * with the invoice it came from.
 */
export function PrintButton({ label = "Save or print this receipt" }: { label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="size-3.5" /> {label}
    </Button>
  );
}
