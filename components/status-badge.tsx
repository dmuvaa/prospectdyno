import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.replaceAll("_", " ");
  const variant =
    status === "QUALIFIED" || status === "approved" || status === "completed" || status === "CUSTOMER"
      ? "success"
      : status === "failed" || status === "NOT_INTERESTED" || status === "SUPPRESSED"
        ? "outline"
        : status === "running" || status === "queued" || status === "pending_review" || status === "RESEARCHING"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{normalized}</Badge>;
}

export function Score({ value }: { value: number }) {
  const color = value >= 80 ? "text-teal-800" : value >= 60 ? "text-amber-800" : "text-muted-foreground";
  return <span className={`font-heading text-3xl ${color}`}>{Math.round(value)}</span>;
}
