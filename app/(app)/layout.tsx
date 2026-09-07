import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { workspace, user } = await requireWorkspace();

  return (
    <AppShell workspace={workspace} email={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
