"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateWorkspaceProfileAction } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceProfileForm({
  name,
  companyName,
  website,
  canEdit,
}: {
  name: string;
  companyName: string;
  website: string;
  canEdit: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canEdit) return;
        setPending(true);
        const result = await updateWorkspaceProfileAction(new FormData(event.currentTarget));
        if (result?.error) toast.error(result.error);
        else toast.success("Workspace saved");
        setPending(false);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company_name">Company</Label>
        <Input id="company_name" name="company_name" defaultValue={companyName} disabled={!canEdit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" defaultValue={website} disabled={!canEdit} />
      </div>
      {canEdit ? (
        <Button type="submit" variant="ink" className="w-fit sm:col-span-3" disabled={pending}>
          {pending ? "Saving…" : "Save workspace"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-3">Only owners and admins can edit workspace details.</p>
      )}
    </form>
  );
}
