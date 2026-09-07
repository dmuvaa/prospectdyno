import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { GenerateMessageButton } from "@/components/generate-message";
import { InboxActions } from "@/components/inbox-actions";
import { PageHeader } from "@/components/page-header";
import { StatusSelect } from "@/components/status-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Score } from "@/components/status-badge";
import { emailsFromCompanySources } from "@/lib/contact-emails";
import { requireWorkspace } from "@/lib/workspace";
import type { ProspectStatus, QualificationReport } from "@prospectdyno/shared";
import Link from "next/link";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!opportunity) notFound();

  const [{ data: company }, { data: evidence }, { data: messages }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", opportunity.company_id).single(),
    supabase.from("evidence_records").select("*").eq("opportunity_id", id),
    supabase
      .from("messages")
      .select("*")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("email")
      .eq("workspace_id", workspace.id)
      .eq("company_id", opportunity.company_id),
  ]);

  const emails = emailsFromCompanySources(contacts, company?.source_metadata);
  const report = opportunity.report as unknown as QualificationReport;
  const why = Array.isArray(opportunity.why) ? (opportunity.why as string[]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/opportunities", label: "Inbox" },
          { label: company?.name ?? "Opportunity" },
        ]}
        kicker="Opportunity report"
        title={company?.name ?? "Opportunity"}
        description={opportunity.recommended_angle ?? undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <InboxActions opportunityId={opportunity.id} showOpen={false} />
            <StatusSelect
              id={opportunity.id}
              value={opportunity.status as ProspectStatus}
              target="opportunity"
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription>Opportunity</CardDescription>
            <Score value={opportunity.opportunity_score} />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Fit</CardDescription>
            <Score value={opportunity.fit_score} />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Intent</CardDescription>
            <Score value={opportunity.intent_score} />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Contactability</CardDescription>
            <Score value={opportunity.contactability_score} />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Confidence</CardDescription>
            <Score value={opportunity.confidence_score} />
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why this company</CardTitle>
          <CardDescription>
            <Link href={`/prospects/${opportunity.company_id}`} className="underline-offset-4 hover:underline">
              View company profile
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{report.company_fit}</p>
          <ul className="list-disc pl-5">
            {why.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            <span className="text-muted-foreground">Recommended service: </span>
            {opportunity.recommended_service}
          </p>
          <p>
            <span className="text-muted-foreground">Talk to: </span>
            {opportunity.recommended_contact}
          </p>
          {emails.length > 0 ? (
            <div>
              <span className="text-muted-foreground">Email: </span>
              {emails.map((email, index) => (
                <span key={email}>
                  {index > 0 ? ", " : ""}
                  <a href={`mailto:${email}`} className="text-teal-800 hover:underline">
                    {email}
                  </a>
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(evidence ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{item.claim}</p>
              <p className="mt-1 text-muted-foreground">{item.evidence}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.source_url} · {item.confidence}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message draft</CardTitle>
          <CardDescription>Generated from stored evidence only. Nothing is sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GenerateMessageButton opportunityId={opportunity.id} />
          {(messages ?? []).map((message) => (
            <div key={message.id} className="space-y-2 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{message.opening_line}</p>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              <p className="text-sm text-muted-foreground">CTA: {message.cta}</p>
              <CopyButton text={message.body} label="Copy message" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
