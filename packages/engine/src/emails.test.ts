import { describe, expect, it } from "vitest";
import { emailsFromUnknown } from "./emails";

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
