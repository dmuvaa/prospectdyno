import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({
  action,
  q,
  status,
  statuses,
  placeholder,
}: {
  action: string;
  q?: string;
  status?: string;
  statuses: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const hasFilters = Boolean(q || status);

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
        defaultValue={status ?? ""}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">All statuses</option>
        {statuses.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
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
