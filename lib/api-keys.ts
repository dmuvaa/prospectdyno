import { createHash, randomBytes } from "node:crypto";

export function createPlainApiKey() {
  return `pd_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyPrefix(key: string) {
  return key.slice(0, 12);
}
