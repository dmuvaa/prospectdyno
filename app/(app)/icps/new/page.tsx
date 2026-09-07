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
        crumbs={[{ href: "/icps", label: "ICPs" }, { label: "New ICP" }]}
        kicker="ICP Builder"
        title="Who are you looking for?"
        description="Write it the way you would brief a researcher. ProspectDyno will turn it into editable criteria for you to confirm."
      />
      <IcpPromptForm defaultPrompt={q ?? ""} examples={EXAMPLE_PROMPTS} />
    </div>
  );
}
