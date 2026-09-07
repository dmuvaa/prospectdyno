import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({
  action,
  q,
  status,
  statuses,
  placeholder,
  allLabel = "All statuses",
  includeAllOption = true,
  defaultStatus = "",
  hunt,
  hunts,
}: {
  action: string;
  q?: string;
  status?: string;
  statuses: Array<{ value: string; label: string }>;
  placeholder: string;
  allLabel?: string;
  includeAllOption?: boolean;
  defaultStatus?: string;
  hunt?: string;
  hunts?: Array<{ value: string; label: string }>;
}) {
  const hasFilters = Boolean(q || status || hunt);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="max-w-xs"
      />
      <select
        name="status"
        defaultValue={status ?? defaultStatus}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {includeAllOption ? <option value="">{allLabel}</option> : null}
        {statuses.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {hunts && hunts.length > 0 ? (
        <select
          name="search"
          defaultValue={hunt ?? ""}
          className="h-9 max-w-xs rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All hunts</option>
          {hunts.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="outline">
        Filter
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href={action}>Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
