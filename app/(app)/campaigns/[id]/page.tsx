import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportButton } from "@/components/export-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/workspace";
import { looseSupabase } from "@/lib/supabase-loose";

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  objective: string | null;
  tone: string | null;
  cta: string | null;
  status: string;
};

type CampaignLeadRow = {
  company_id: string;
  status: string;
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  const { data: campaign } = await db
    .from<CampaignRow>("campaigns")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: leads } = await db
    .from<CampaignLeadRow[]>("campaign_leads")
    .select("company_id, status")
    .eq("workspace_id", workspace.id)
    .eq("campaign_id", id);
  const companyIds = (leads ?? []).map((lead) => lead.company_id);
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, domain, status").in("id", companyIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/campaigns", label: "Campaigns" },
          { label: campaign.name },
        ]}
        kicker={campaign.channel}
        title={campaign.name}
        description={campaign.objective ?? undefined}
        action={<ExportButton companyIds={companyIds} />}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Leads" value={companyIds.length} />
        <Metric label="Status" value={campaign.status} />
        <Metric label="Tone" value={campaign.tone ?? "Unset"} />
        <Metric label="CTA" value={campaign.cta ?? "Unset"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign leads</CardTitle>
        </CardHeader>
        <CardContent>
          {companies && companies.length > 0 ? (
            <ul className="divide-y divide-border">
              {companies.map((company) => (
                <li key={company.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{company.domain}</p>
                  </div>
                  <StatusBadge status={company.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No companies are attached yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">{label}</p>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
