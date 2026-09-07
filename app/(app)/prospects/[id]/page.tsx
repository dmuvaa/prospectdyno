import { notFound } from "next/navigation";
import { AddToList } from "@/components/add-to-list";
import { PageHeader } from "@/components/page-header";
import { StatusSelect } from "@/components/status-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Score } from "@/components/status-badge";
import { CompanyNotesForm } from "@/components/company-notes";
import { requireWorkspace } from "@/lib/workspace";
import type { ProspectStatus } from "@prospectdyno/shared";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!company) notFound();

  const [{ data: contacts }, { data: audits }, { data: opportunities }, { data: lists }] = await Promise.all([
    supabase.from("contacts").select("*").eq("company_id", id).eq("workspace_id", workspace.id),
    supabase
      .from("website_audits")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("opportunities")
      .select("id, opportunity_score, recommended_angle, status")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("lists").select("id, name").eq("workspace_id", workspace.id),
  ]);

  const audit = audits?.[0];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={company.industry ?? "Company"}
        title={company.name}
        description={company.website ?? company.domain ?? undefined}
        action={<StatusSelect id={company.id} value={company.status as ProspectStatus} target="company" />}
      />

      <div className="flex flex-wrap items-center gap-4">
        <AddToList companyId={company.id} lists={lists ?? []} />
      </div>

      {audit ? (
        <div className="grid gap-4 sm:grid-cols-5">
          <ScoreCard label="Website" value={audit.website_score} />
          <ScoreCard label="SEO" value={audit.seo_score} />
          <ScoreCard label="Technical" value={audit.technical_score} />
          <ScoreCard label="UX" value={audit.ux_score} />
          <ScoreCard label="Conversion" value={audit.conversion_score} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Field label="Country" value={company.country} />
          <Field label="City" value={company.city} />
          <Field label="Employees" value={company.employee_count?.toString()} />
          <Field label="Source" value={company.source} />
          <div className="sm:col-span-2">
            <Field label="Description" value={company.description} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyNotesForm companyId={company.id} notes={company.notes ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts && contacts.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  {contact.name ?? "Unknown"} {contact.title ? `· ${contact.title}` : ""}{" "}
                  {contact.email ? `· ${contact.email}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No contacts stored yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opportunities</CardTitle>
          <CardDescription>Qualification results for this company.</CardDescription>
        </CardHeader>
        <CardContent>
          {opportunities && opportunities.length > 0 ? (
            <ul className="space-y-2">
              {opportunities.map((row) => (
                <li key={row.id} className="flex items-center justify-between">
                  <a href={`/opportunities/${row.id}`} className="hover:underline">
                    {row.recommended_angle ?? "Opportunity"}
                  </a>
                  <span className="font-heading text-xl">{row.opportunity_score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Not qualified yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <Score value={value ?? 0} />
      </CardHeader>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value || "—"}
    </p>
  );
}
