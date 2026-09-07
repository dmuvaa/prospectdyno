"use client";

import { exportCompaniesCsv } from "@/lib/actions/export";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export function ExportButton({ companyIds }: { companyIds?: string[] }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await exportCompaniesCsv(companyIds);
        if ("error" in result && result.error) {
          toast.error(result.error);
          setPending(false);
          return;
        }
        const blob = new Blob([result.csv ?? ""], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "prospectdyno-export.csv";
        link.click();
        URL.revokeObjectURL(url);
        toast.success("CSV downloaded");
        setPending(false);
      }}
    >
      {pending ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
