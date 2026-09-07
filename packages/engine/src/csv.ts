import type { Candidate } from "@prospectdyno/shared";
import { normalizeDomain, websiteFromDomain } from "./normalize";

function cell(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const match = Object.keys(row).find((item) => item.trim().toLowerCase() === key);
    const value = match ? row[match]?.trim() : "";
    if (value) return value;
  }
  return null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}

export function parseCsv(text: string): Candidate[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0] ?? "");
  const rows: Candidate[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    const website = cell(record, ["website", "url", "site"]);
    const domain = normalizeDomain(cell(record, ["domain", "website", "url"]) ?? website);
    const name = cell(record, ["name", "company", "company_name", "business"]);
    if (!name && !domain) continue;

    rows.push({
      name: name ?? domain ?? "Unknown company",
      website: website ?? websiteFromDomain(domain),
      domain,
      country: cell(record, ["country", "nation"]),
      city: cell(record, ["city", "town"]),
      industry: cell(record, ["industry", "category"]),
      description: cell(record, ["description", "about"]),
      employee_count: parseNumber(cell(record, ["employees", "employee_count", "size"])),
      contact_name: cell(record, ["contact_name", "contact", "full_name"]),
      contact_title: cell(record, ["title", "job_title", "contact_title"]),
      email: cell(record, ["email", "contact_email"]),
      phone: cell(record, ["phone", "telephone"]),
      source: "csv",
      source_metadata: { raw: record },
    });
  }

  return rows;
}

export function parseUrlList(text: string): Candidate[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const domain = normalizeDomain(line);
      return {
        name: domain ?? line,
        website: line.includes("://") ? line : websiteFromDomain(domain),
        domain,
        source: "website" as const,
        source_metadata: { input: line },
      };
    })
    .filter((item) => item.domain);
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
