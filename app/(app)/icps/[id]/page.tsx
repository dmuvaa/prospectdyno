import { notFound } from "next/navigation";
import { emptyInterpretation, type IcpInterpretation } from "@prospectdyno/shared";
import { IcpEditor } from "@/components/icp/editor";
import { requireWorkspace } from "@/lib/workspace";

export default async function IcpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const { data: icp } = await supabase
    .from("icps")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!icp) {
    notFound();
  }

  const criteria = {
    ...emptyInterpretation(),
    ...(icp.criteria as Partial<IcpInterpretation>),
  };

  return (
    <IcpEditor
      icpId={icp.id}
      name={icp.name}
      originalPrompt={icp.original_prompt}
      status={icp.status}
      criteria={criteria}
    />
  );
}
