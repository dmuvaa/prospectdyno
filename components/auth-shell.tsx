import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex">
          <Logo />
        </Link>
        <h1 className="font-heading text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
