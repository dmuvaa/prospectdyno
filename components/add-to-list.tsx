"use client";

import { useState, useTransition } from "react";
import { addToListAction } from "@/lib/actions/list";
import { Button } from "@/components/ui/button";

export function AddToList({
  companyId,
  lists,
}: {
  companyId: string;
  lists: Array<{ id: string; name: string }>;
}) {
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (lists.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a list first.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={listId}
        onChange={(event) => setListId(event.target.value)}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await addToListAction(listId, companyId);
            if (result.error) {
              setMessage(result.error);
            } else {
              setMessage("Saved to list");
            }
          })
        }
      >
        Save to list
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
