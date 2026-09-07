import { describe, expect, it } from "vitest";
import { emailsFromCompanySources } from "./contact-emails";

describe("emailsFromCompanySources", () => {
  it("merges contact rows and company metadata", () => {
    expect(emailsFromCompanySources(
      [{ email: "info@msetotravel.com" }],
      { emails: [{ email: "bookings@msetotravel.com" }] },
    )).toEqual(["info@msetotravel.com", "bookings@msetotravel.com"]);
  });
});
