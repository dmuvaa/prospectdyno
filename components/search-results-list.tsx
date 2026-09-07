"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchCompanyRow } from "@/lib/search-live-data";
import { InboxActions } from "@/components/inbox-actions";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";

export type { SearchCompanyRow };

export function SearchResultsList({
  companies,
  running,
  opportunityCount,
  persistedCount,
}: {
  companies: SearchCompanyRow[];
  running: boolean;
  opportunityCount: number;
  persistedCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const seen = useRef(new Set(companies.map((company) => company.id)));
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const total = Math.max(companies.length, persistedCount ?? 0);

  useEffect(() => {
    const newcomers = companies.filter((company) => !seen.current.has(company.id)).map((company) => company.id);
    if (newcomers.length === 0) return;
    for (const id of newcomers) seen.current.add(id);
    setFreshIds(new Set(newcomers));
    const timer = setTimeout(() => setFreshIds(new Set()), 1200);
    return () => clearTimeout(timer);
  }, [companies]);

  const statuses = useMemo(
    () => [...new Set(companies.map((company) => company.status))].sort(),
    [companies],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return companies
      .filter((company) => {
        if (status && company.status !== status) return false;
        if (!term) return true;
        return [company.name, company.domain, company.city, company.country, company.industry, company.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (a.score != null && b.score != null) return b.score - a.score;
        if (a.score != null) return -1;
        if (b.score != null) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [companies, query, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {visible.length === total
            ? `${total} companies`
            : `${visible.length} of ${total} companies`}
          {" · "}
            {opportunityCount} scored
            {companies.filter((company) => company.email).length
              ? ` · ${companies.filter((company) => company.email).length} emails`
              : ""}
        </p>
        {companies.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, city, industry"
              className="max-w-xs"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((company) => {
            const location = [company.city, company.country].filter(Boolean).join(", ");
            return (
              <li
                key={company.id}
                className={`rounded-xl border border-border bg-card p-4 shadow-sm ${freshIds.has(company.id) ? "animate-rise-in ring-1 ring-teal-700/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/prospects/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {[company.domain, location, company.industry].filter(Boolean).join(" · ")}
                    </p>
                    {company.email ? (
                      <a href={`mailto:${company.email}`} className="mt-1 block text-sm text-teal-800 hover:underline">
                        {company.email}
                      </a>
                    ) : running && !company.score ? (
                      <p className="mt-1 text-xs text-muted-foreground">Looking up email…</p>
                    ) : null}
                    {company.phone ? <p className="text-sm text-muted-foreground">{company.phone}</p> : null}
                    {company.angle ? <p className="mt-1 text-sm">{company.angle}</p> : null}
                  </div>
                  <div className="text-right">
                    {company.score != null ? (
                      <p className="font-heading text-3xl">{Math.round(company.score)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{running ? "Working…" : "—"}</p>
                    )}
                    <StatusBadge status={company.status} />
                  </div>
                </div>
                {company.opportunityId ? (
                  <div className="mt-3">
                    <InboxActions opportunityId={company.opportunityId} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {companies.length > 0
            ? "No companies match this filter."
            : running
              ? "Companies will appear here as soon as they are saved."
              : "No companies in this search yet."}
        </div>
      )}
    </div>
  );
}
