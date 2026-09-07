import { IcpPromptForm } from "@/components/icp/prompt-form";
import { EXAMPLE_PROMPTS } from "@/lib/examples";

export default async function NewIcpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-800">ICP Builder</p>
        <h1 className="font-heading mt-1 text-4xl">Who are you looking for?</h1>
        <p className="mt-2 text-muted-foreground">
          Write it the way you would brief a researcher. ProspectDyno will turn it into
          editable criteria for you to confirm.
        </p>
      </div>
      <IcpPromptForm defaultPrompt={q ?? ""} examples={EXAMPLE_PROMPTS} />
    </div>
  );
}
