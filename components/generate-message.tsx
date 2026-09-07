"use client";

import { generateMessageAction } from "@/lib/actions/opportunity";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function GenerateMessageButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ink"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await generateMessageAction(opportunityId);
          if (result.error) setError(result.error);
          else toast.success("Draft generated. Nothing was sent.");
          router.refresh();
          setPending(false);
        }}
      >
        {pending ? "Writing…" : "Generate message"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
