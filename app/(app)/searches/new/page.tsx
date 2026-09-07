import { SearchForm } from "@/components/search-form";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/workspace";
import Link from "next/link";

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
        crumbs={[{ href: "/searches", label: "History" }, { label: "Advanced" }]}
        kicker="Advanced"
        title="CSV, Apify, or a named import"
        description="Use this when you already have a file or want a custom discovery plan. For a normal hunt, describe who you want on Run."
      />
      <p className="text-sm">
        <Link href="/dashboard" className="text-teal-800 hover:underline">
          Start a hunt from Run
        </Link>
      </p>
      <SearchForm icps={icps ?? []} defaultIcpId={icpId} />
    </div>
  );
}
