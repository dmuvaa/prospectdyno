"use client";

import { useState, useTransition } from "react";
import { PROSPECT_STATUSES, type ProspectStatus } from "@prospectdyno/shared";
import { updateCompanyStatusAction } from "@/lib/actions/company";
import { updateOpportunityStatusAction } from "@/lib/actions/opportunity";

export function StatusSelect({
  id,
  value,
  target,
}: {
  id: string;
  value: ProspectStatus;
  target: "company" | "opportunity";
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);

  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={current}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as ProspectStatus;
        setCurrent(next);
        startTransition(async () => {
          if (target === "company") await updateCompanyStatusAction(id, next);
          else await updateOpportunityStatusAction(id, next);
        });
      }}
    >
      {PROSPECT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
