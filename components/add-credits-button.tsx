"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addWorkspaceCreditsAction } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";

export function AddCreditsButton({ amount = 2000 }: { amount?: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await addWorkspaceCreditsAction(amount);
        if (result.error) toast.error(result.error);
        else {
          toast.success(`Added ${amount.toLocaleString()} credits.`);
          router.refresh();
        }
        setPending(false);
      }}
    >
      {pending ? "Adding…" : `Add ${amount.toLocaleString()} credits`}
    </Button>
  );
}
