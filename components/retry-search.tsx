"use client";

import { retrySearchAction } from "@/lib/actions/search";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetrySearchButton({ searchId }: { searchId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await retrySearchAction(searchId);
        router.refresh();
        setPending(false);
      }}
    >
      Retry search
    </Button>
  );
}
