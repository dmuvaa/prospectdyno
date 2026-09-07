import { describe, expect, it } from "vitest";
import { parseCsv, parseUrlList } from "./csv";

describe("parseCsv", () => {
  it("maps common company and contact columns into candidates", () => {
    const rows = parseCsv(`company,website,country,email,employees
Acme Agency,https://www.acme.test,United Kingdom,founder@acme.test,25`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Acme Agency",
      domain: "acme.test",
      country: "United Kingdom",
      email: "founder@acme.test",
      employee_count: 25,
    });
  });

  it("handles quoted commas", () => {
    const rows = parseCsv(`name,description,domain
"Acme, Ltd","SEO, PPC, and web",acme.test`);

    expect(rows[0]?.name).toBe("Acme, Ltd");
    expect(rows[0]?.description).toBe("SEO, PPC, and web");
  });
});

describe("parseUrlList", () => {
  it("turns domains into website candidates", () => {
    expect(parseUrlList("example.com")[0]).toMatchObject({
      domain: "example.com",
      website: "https://example.com",
    });
  });
});
