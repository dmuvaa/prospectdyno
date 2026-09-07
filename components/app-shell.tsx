import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import type { Workspace } from "@/lib/workspace";

export function AppShell({
  workspace,
  email,
  workspaces,
  children,
}: {
  workspace: Workspace;
  email: string;
  workspaces: Array<{ id: string; name: string }>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[16rem_1fr]">
      <AppNav workspace={workspace} email={email} workspaces={workspaces} />
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
