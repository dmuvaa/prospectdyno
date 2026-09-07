"use client";

import { retrySearchAction } from "@/lib/actions/search";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function RetrySearchButton({
  searchId,
  compact = false,
}: {
  searchId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      size={compact ? "sm" : "default"}
      disabled={pending}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPending(true);
        const result = await retrySearchAction(searchId);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Search queued again. The worker will pick it up shortly.");
          router.refresh();
        }
        setPending(false);
      }}
    >
      {pending ? "Queuing…" : compact ? "Retry" : "Retry search"}
    </Button>
  );
}
