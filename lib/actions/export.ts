"use server";

import { CREDIT_COSTS } from "@prospectdyno/shared";
import { normalizeDomain } from "@prospectdyno/engine";
import { recordAudit } from "@/lib/audit";
import { consumeCredits } from "@/lib/metering";
import { looseSupabase } from "@/lib/supabase-loose";
import { requireWorkspace } from "@/lib/workspace";

export async function exportCompaniesCsv(companyIds?: string[]) {
  const { supabase, user, workspace } = await requireWorkspace();
  const db = looseSupabase(supabase);
  let query = supabase
    .from("companies")
    .select("name, domain, website, country, city, industry, employee_count, status, description")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (companyIds?.length) {
    query = query.in("id", companyIds);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const { data: suppressions } = await db
    .from<Array<{ domain: string | null; normalized_domain: string | null }>>("suppression_records")
    .select("domain, normalized_domain")
    .eq("workspace_id", workspace.id);
  const suppressedDomains = new Set(
    (suppressions ?? [])
      .map((row) =>
        row.normalized_domain ?? normalizeDomain(row.domain),
      )
      .filter((domain: string | null): domain is string => Boolean(domain)),
  );

  const exportable = (data ?? []).filter((row) => {
    const domain = normalizeDomain(row.domain ?? row.website);
    return !domain || !suppressedDomains.has(domain);
  });

  const header = [
    "name",
    "domain",
    "website",
    "country",
    "city",
    "industry",
    "employee_count",
    "status",
    "description",
  ];
  const rows = exportable.map((row) =>
    header
      .map((key) => csvCell(String((row as Record<string, unknown>)[key] ?? "")))
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const exportId = crypto.randomUUID();

  await consumeCredits(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    eventType: "export",
    credits: CREDIT_COSTS.export,
    metadata: { count: rows.length, suppressed: (data ?? []).length - exportable.length },
    idempotencyKey: `export:${exportId}`,
  });

  const objectPath = `${workspace.id}/exports/${exportId}.csv`;
  const { error: storageError } = await supabase.storage.from("exports").upload(objectPath, csv, {
    contentType: "text/csv",
    upsert: false,
  });

  if (!storageError) {
    await db.from("storage_artifacts").insert({
      workspace_id: workspace.id,
      bucket: "exports",
      object_path: objectPath,
      artifact_type: "companies_csv",
      entity_type: "export",
      entity_id: null,
      content_type: "text/csv",
      byte_size: Buffer.byteLength(csv),
      created_by: user.id,
      metadata: { count: rows.length },
    });
  }

  await recordAudit(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
    action: "companies.exported",
    entityType: "export",
    metadata: { count: rows.length, suppressed: (data ?? []).length - exportable.length },
  });

  return { csv };
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
