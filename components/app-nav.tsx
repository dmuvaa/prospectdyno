"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  History,
  Inbox,
  ListFilter,
  ListTodo,
  LogOut,
  Megaphone,
  Menu,
  Play,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace";

const groups = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Run", icon: Play },
      { href: "/opportunities", label: "Inbox", icon: Inbox },
      { href: "/prospects", label: "Companies", icon: Briefcase },
      { href: "/searches", label: "History", icon: History },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/icps", label: "Briefs", icon: ListFilter },
      { href: "/lists", label: "Lists", icon: ListTodo },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/usage", label: "Credits", icon: Sparkles },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({
  workspace,
  email,
  workspaces,
}: {
  workspace: Workspace;
  email: string;
  workspaces: Array<{ id: string; name: string }>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-heading text-lg">
          ProspectDyno
        </Link>
        <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </Button>
      </header>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-ink text-ink-foreground transition-transform lg:static lg:z-0 lg:w-64 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col px-4 py-5">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="px-2 text-ink-foreground" onClick={() => setOpen(false)}>
              <span className="inline-flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-semibold">
                  Pd
                </span>
                <span className="font-heading text-lg tracking-tight">ProspectDyno</span>
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </Button>
          </div>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600"
          >
            <Sparkles className="size-4" />
            Find companies
          </Link>

          <nav className="mt-6 space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-white/40">{group.label}</p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                          active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto space-y-3 rounded-lg bg-white/5 p-3">
            <WorkspaceSwitcher
              currentId={workspace.id}
              workspaces={workspaces}
            />
            <div>
              <p className="truncate text-sm font-medium">{workspace.name}</p>
              <p className="truncate text-xs text-white/55">{email}</p>
              <Link href="/usage" className="mt-1 block text-xs text-teal-200/80 hover:underline">
                {workspace.credit_balance} credits
              </Link>
            </div>
            <form action={signOut}>
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
    </>
  );
}
