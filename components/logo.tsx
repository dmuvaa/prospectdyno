import { cn } from "@/lib/utils";

export function Logo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-semibold tracking-tight text-white">
        Pd
      </span>
      {!markOnly ? (
        <span className="font-heading text-lg tracking-tight">
          Prospect<span className="text-teal-800">Dyno</span>
        </span>
      ) : null}
    </span>
  );
}
