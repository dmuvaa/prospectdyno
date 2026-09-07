"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { IcpInterpretation, IcpStatus } from "@prospectdyno/shared";
import { toast } from "sonner";
import { archiveIcpAction, saveIcpAction } from "@/lib/actions/icp";
import { TagList } from "@/components/icp/tag-list";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IcpEditor({
  icpId,
  name: initialName,
  originalPrompt,
  status,
  criteria: initialCriteria,
}: {
  icpId: string;
  name: string;
  originalPrompt: string;
  status: IcpStatus;
  criteria: IcpInterpretation;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "approved" | "archive" | null>(null);

  function patchCompany(patch: Partial<IcpInterpretation["company"]>) {
    setCriteria((current) => ({ ...current, company: { ...current.company, ...patch } }));
  }

  function patchBusiness(patch: Partial<IcpInterpretation["business"]>) {
    setCriteria((current) => ({ ...current, business: { ...current.business, ...patch } }));
  }

  function patchTechnology(patch: Partial<IcpInterpretation["technology"]>) {
    setCriteria((current) => ({ ...current, technology: { ...current.technology, ...patch } }));
  }

  async function save(nextStatus: "pending_review" | "approved") {
    setPending(nextStatus === "approved" ? "approved" : "draft");
    setError(null);
    const result = await saveIcpAction(icpId, {
      name,
      criteria: { ...criteria, name },
      status: nextStatus,
    });
    if (result.error) {
      setError(result.error);
      setPending(null);
      return;
    }
    setPending(null);
    toast.success(nextStatus === "approved" ? "ICP confirmed" : "Draft saved");
    router.refresh();
  }

  async function archive() {
    setPending("archive");
    const result = await archiveIcpAction(icpId);
    if (result?.error) {
      setError(result.error);
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/icps", label: "Briefs" }, { label: name || "Brief" }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-800">Review interpretation</p>
          <h1 className="font-heading mt-1 text-4xl">I interpreted your ICP this way. Is this correct?</h1>
        </div>
        <Badge variant={status === "approved" ? "success" : "warning"}>
          {status.replace("_", " ")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Original description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{originalPrompt}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Edit anything that does not match what you meant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icp-name">Name</Label>
            <Input id="icp-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icp-summary">Summary</Label>
            <Textarea
              id="icp-summary"
              value={criteria.summary}
              onChange={(event) => setCriteria((current) => ({ ...current, summary: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Industries">
              <TagList
                values={criteria.company.industries}
                onChange={(industries) => patchCompany({ industries })}
                placeholder="Add industry"
              />
            </Field>
            <Field label="Countries">
              <TagList
                values={criteria.company.countries}
                onChange={(countries) => patchCompany({ countries })}
                placeholder="Add country"
              />
            </Field>
            <Field label="Regions">
              <TagList
                values={criteria.company.regions}
                onChange={(regions) => patchCompany({ regions })}
                placeholder="Add region"
              />
            </Field>
            <Field label="Cities">
              <TagList
                values={criteria.company.cities}
                onChange={(cities) => patchCompany({ cities })}
                placeholder="Add city"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employees min">
                <Input
                  type="number"
                  value={criteria.company.employee_min ?? ""}
                  onChange={(event) =>
                    patchCompany({
                      employee_min: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Employees max">
                <Input
                  type="number"
                  value={criteria.company.employee_max ?? ""}
                  onChange={(event) =>
                    patchCompany({
                      employee_max: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Company types">
              <TagList
                values={criteria.company.company_types}
                onChange={(company_types) => patchCompany({ company_types })}
                placeholder="Agency, SaaS, consultancy…"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Services">
              <TagList
                values={criteria.business.services}
                onChange={(services) => patchBusiness({ services })}
                placeholder="Add service"
              />
            </Field>
            <Field label="Customer type">
              <TagList
                values={criteria.business.customer_types}
                onChange={(customer_types) => patchBusiness({ customer_types })}
                placeholder="SMB, enterprise…"
              />
            </Field>
            <Field label="Business model">
              <TagList
                values={criteria.business.business_models}
                onChange={(business_models) => patchBusiness({ business_models })}
                placeholder="B2B, B2C…"
              />
            </Field>
            <Field label="Markets">
              <TagList
                values={criteria.business.markets}
                onChange={(markets) => patchBusiness({ markets })}
                placeholder="Add market"
              />
            </Field>
            <Field label="Signals">
              <TagList
                values={criteria.signals}
                onChange={(signals) => setCriteria((current) => ({ ...current, signals }))}
                placeholder="Hiring, expansion, new website…"
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Technology</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="CMS">
            <TagList values={criteria.technology.cms} onChange={(cms) => patchTechnology({ cms })} placeholder="WordPress, Webflow…" />
          </Field>
          <Field label="Ecommerce">
            <TagList
              values={criteria.technology.ecommerce}
              onChange={(ecommerce) => patchTechnology({ ecommerce })}
              placeholder="Shopify, WooCommerce…"
            />
          </Field>
          <Field label="Analytics">
            <TagList
              values={criteria.technology.analytics}
              onChange={(analytics) => patchTechnology({ analytics })}
              placeholder="GA4, Mixpanel…"
            />
          </Field>
          <Field label="Frameworks">
            <TagList
              values={criteria.technology.frameworks}
              onChange={(frameworks) => patchTechnology({ frameworks })}
              placeholder="Next.js, Laravel…"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom AI criteria</CardTitle>
          <CardDescription>
            These are evaluated against each company later, with a score, evidence, and confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {criteria.custom_criteria.map((item, index) => (
            <div key={`${item.name}-${index}`} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={item.name}
                onChange={(event) => {
                  const custom_criteria = [...criteria.custom_criteria];
                  custom_criteria[index] = { ...item, name: event.target.value };
                  setCriteria((current) => ({ ...current, custom_criteria }));
                }}
                placeholder="Name"
              />
              <Input
                value={item.description}
                onChange={(event) => {
                  const custom_criteria = [...criteria.custom_criteria];
                  custom_criteria[index] = { ...item, description: event.target.value };
                  setCriteria((current) => ({ ...current, custom_criteria }));
                }}
                placeholder="What should we look for?"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setCriteria((current) => ({
                    ...current,
                    custom_criteria: current.custom_criteria.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setCriteria((current) => ({
                ...current,
                custom_criteria: [...current.custom_criteria, { name: "", description: "" }],
              }))
            }
          >
            Add criterion
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="ink" disabled={pending !== null} onClick={() => void save("approved")}>
          {pending === "approved" ? "Saving…" : "Confirm ICP"}
        </Button>
        {status === "approved" ? (
          <Button asChild variant="outline">
            <Link href={`/dashboard?icpId=${icpId}`}>Start a hunt</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void save("pending_review")}>
          {pending === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => void archive()}>
          Archive
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
