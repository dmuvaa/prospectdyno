import { describe, expect, it } from "vitest";
import { extractEmails } from "./crawl";

describe("extractEmails", () => {
  it("prefers same-domain addresses and drops junk", () => {
    expect(extractEmails(
      "Contact info@optiven.co.ke or noreply@optiven.co.ke and hello@example.com",
      "https://www.optiven.co.ke/",
    )).toEqual(["info@optiven.co.ke"]);
  });

  it("keeps a few real emails when the domain is unknown", () => {
    expect(extractEmails("Reach sales@amgrealtors.com or martin@amgrealtors.com")).toEqual([
      "sales@amgrealtors.com",
      "martin@amgrealtors.com",
    ]);
  });
});
