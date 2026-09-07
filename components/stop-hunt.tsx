"use client";

import { cancelSearchAction } from "@/lib/actions/search";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function StopHuntButton({
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
      variant={compact ? "ghost" : "destructive"}
      size={compact ? "sm" : "default"}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await cancelSearchAction(searchId);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Hunt stopped. Companies already found were kept.");
          router.refresh();
        }
        setPending(false);
      }}
    >
      {pending ? "Stopping…" : compact ? "Stop" : "Stop hunt"}
    </Button>
  );
}
