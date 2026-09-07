"use client";

import { updateCompanyNotesAction } from "@/lib/actions/company";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export function CompanyNotesForm({ companyId, notes }: { companyId: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await updateCompanyNotesAction(companyId, value);
        if (result.error) toast.error(result.error);
        else toast.success("Notes saved");
        setPending(false);
      }}
    >
      <Textarea value={value} onChange={(event) => setValue(event.target.value)} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </form>
  );
}
