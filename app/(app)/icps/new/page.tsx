import { IcpPromptForm } from "@/components/icp/prompt-form";
import { PageHeader } from "@/components/page-header";
import { EXAMPLE_PROMPTS } from "@/lib/examples";

export default async function NewIcpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/icps", label: "Briefs" }, { label: "New brief" }]}
        kicker="Briefs"
        title="Who are you looking for?"
        description="Write it the way you would brief a researcher. Confirm the criteria, then hunt from Run — or start the hunt directly there."
      />
      <IcpPromptForm defaultPrompt={q ?? ""} examples={EXAMPLE_PROMPTS} />
    </div>
  );
}
