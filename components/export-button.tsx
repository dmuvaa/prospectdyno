"use client";

import { exportCompaniesCsv } from "@/lib/actions/export";
import { Button } from "@/components/ui/button";

export function ExportButton({ companyIds }: { companyIds?: string[] }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        const result = await exportCompaniesCsv(companyIds);
        if ("error" in result && result.error) return;
        const blob = new Blob([result.csv ?? ""], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "prospectdyno-export.csv";
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      Export CSV
    </Button>
  );
}
