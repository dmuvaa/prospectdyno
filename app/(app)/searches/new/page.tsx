import { SearchForm } from "@/components/search-form";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/workspace";

export default async function NewSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ icpId?: string }>;
}) {
  const { icpId } = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  const { data: icps } = await supabase
    .from("icps")
    .select("id, name, status")
    .eq("workspace_id", workspace.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/searches", label: "Searches" }, { label: "New search" }]}
        kicker="Discovery"
        title="Start a search"
        description="Choose an approved ICP, then import companies or generate an Apify plan."
      />
      <SearchForm icps={icps ?? []} defaultIcpId={icpId} />
    </div>
  );
}
