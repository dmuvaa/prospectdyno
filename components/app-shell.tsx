import Link from "next/link";
import {
  Briefcase,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  LogOut,
  Megaphone,
  Radar,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import type { Workspace } from "@/lib/workspace";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: Radar },
  { href: "/prospects", label: "Prospects", icon: Briefcase },
  { href: "/searches", label: "Searches", icon: Search },
  { href: "/icps", label: "ICPs", icon: ListFilter },
  { href: "/lists", label: "Lists", icon: ListTodo },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  workspace,
  email,
  children,
}: {
  workspace: Workspace;
  email: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="bg-ink text-ink-foreground">
        <div className="flex h-full flex-col px-4 py-5">
          <Link href="/dashboard" className="px-2 text-ink-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-semibold">
                Pd
              </span>
              <span className="font-heading text-lg tracking-tight">ProspectDyno</span>
            </span>
          </Link>

          <Link
            href="/searches/new"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600"
          >
            <Sparkles className="size-4" />
            New search
          </Link>

          <nav className="mt-6 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-lg bg-white/5 p-3">
            <p className="truncate text-sm font-medium">{workspace.name}</p>
            <p className="truncate text-xs text-white/55">{email}</p>
            <p className="mt-1 text-xs text-teal-200/80">{workspace.credit_balance} credits</p>
            <form action={signOut} className="mt-3">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start px-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-h-full">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
