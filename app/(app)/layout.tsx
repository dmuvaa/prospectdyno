import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { workspace, user, memberships } = await requireWorkspace();

  return (
    <AppShell
      workspace={workspace}
      email={user.email ?? ""}
      workspaces={memberships.map((item) => ({ id: item.workspace.id, name: item.workspace.name }))}
    >
      {children}
    </AppShell>
  );
}
