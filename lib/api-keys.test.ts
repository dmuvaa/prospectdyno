import { describe, expect, it } from "vitest";
import { apiKeyPrefix, createPlainApiKey, hashApiKey } from "./api-keys";

describe("api keys", () => {
  it("creates prefixed keys and hashes them deterministically", () => {
    const key = createPlainApiKey();

    expect(key.startsWith("pd_")).toBe(true);
    expect(apiKeyPrefix(key)).toBe(key.slice(0, 12));
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toBe(key);
  });
});
