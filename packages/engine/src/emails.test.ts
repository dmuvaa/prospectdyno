import { describe, expect, it } from "vitest";
import { emailsFromUnknown, mergeEmailMetadata } from "./emails";

describe("emailsFromUnknown", () => {
  it("reads strings, arrays, and Apify email objects", () => {
    expect(emailsFromUnknown({
      emails: [
        "info@msetotravel.com",
        { email: "bookings@msetotravel.com" },
      ],
      email: "hello@msetotravel.com",
    })).toEqual([
      "hello@msetotravel.com",
      "info@msetotravel.com",
      "bookings@msetotravel.com",
    ]);
  });

  it("drops junk addresses", () => {
    expect(emailsFromUnknown(["noreply@msetotravel.com", "logo@cdn.example.com"])).toEqual([]);
  });
});

describe("mergeEmailMetadata", () => {
  it("keeps emails when the stored record had an empty list", () => {
    expect(mergeEmailMetadata(
      { emails: [], phone: "+254 700 000002" },
      { emails: ["move@nellions.co.ke"] },
    ).emails).toEqual(["move@nellions.co.ke"]);
  });
});
