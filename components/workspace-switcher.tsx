"use client";

import { selectWorkspaceAction } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({
  currentId,
  workspaces,
  tone = "dark",
}: {
  currentId: string;
  workspaces: Array<{ id: string; name: string }>;
  tone?: "dark" | "light";
}) {
  if (workspaces.length < 2) {
    return null;
  }

  return (
    <label className="block space-y-1">
      <span
        className={cn(
          "text-[11px] uppercase tracking-wide",
          tone === "dark" ? "text-white/45" : "text-muted-foreground",
        )}
      >
        Workspace
      </span>
      <select
        className={cn(
          "h-8 w-full rounded-md border px-2 text-xs",
          tone === "dark"
            ? "border-white/10 bg-white/5 text-white"
            : "border-input bg-background text-foreground",
        )}
        defaultValue={currentId}
        onChange={(event) => {
          void selectWorkspaceAction(event.target.value);
        }}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id} className="text-foreground">
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
