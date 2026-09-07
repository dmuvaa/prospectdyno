import { notFound } from "next/navigation";
import { ExportButton } from "@/components/export-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { removeFromListAction } from "@/lib/actions/list";
import { requireWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const { data: list } = await supabase
    .from("lists")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!list) notFound();

  const { data: members } = await supabase
    .from("list_members")
    .select("company_id")
    .eq("list_id", id);
  const companyIds = (members ?? []).map((row) => row.company_id);
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain, status").in("id", companyIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader title={list.name} description={list.description ?? undefined} action={<ExportButton companyIds={companyIds} />} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(companies ?? []).map((company) => (
          <li key={company.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                {company.name}
              </Link>
              <p className="text-sm text-muted-foreground">{company.domain}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={company.status} />
              <form action={removeFromListAction.bind(null, id, company.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
