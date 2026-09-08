import { IcpPromptForm } from "@/components/icp/prompt-form";
import { PageHeader } from "@/components/page-header";

export default async function NewIcpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const looksLikeSite = Boolean(q && /(\.|https?:\/\/)/i.test(q));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/icps", label: "Briefs" }, { label: "New brief" }]}
        kicker="Briefs"
        title="Start with your website"
        description="We scrutinize the site, draft the companies you should find, and leave you to confirm or edit."
      />
      <IcpPromptForm defaultWebsite={looksLikeSite ? q ?? "" : ""} defaultNotes={looksLikeSite ? "" : q ?? ""} />
    </div>
  );
}
