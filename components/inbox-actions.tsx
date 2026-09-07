"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateOpportunityStatusAction } from "@/lib/actions/opportunity";
import { Button } from "@/components/ui/button";

export function InboxActions({
  opportunityId,
  showOpen = true,
}: {
  opportunityId: string;
  showOpen?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"keep" | "skip" | null>(null);

  async function setStatus(status: "SAVED" | "NOT_INTERESTED", kind: "keep" | "skip") {
    setPending(kind);
    const result = await updateOpportunityStatusAction(opportunityId, status);
    if (result.error) toast.error(result.error);
    else {
      toast.success(kind === "keep" ? "Saved to work" : "Skipped");
      router.refresh();
    }
    setPending(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="ink"
        disabled={pending !== null}
        onClick={() => void setStatus("SAVED", "keep")}
      >
        {pending === "keep" ? "Saving…" : "Keep"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending !== null}
        onClick={() => void setStatus("NOT_INTERESTED", "skip")}
      >
        {pending === "skip" ? "Skipping…" : "Skip"}
      </Button>
      {showOpen ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/opportunities/${opportunityId}`}>Open</Link>
        </Button>
      ) : null}
    </div>
  );
}
