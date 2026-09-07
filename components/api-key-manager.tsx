"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ApiKeyListItem = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function ApiKeyManager({ apiKeys }: { apiKeys: ApiKeyListItem[] }) {
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createKey() {
    setPending(true);
    setError(null);
    setCreatedKey(null);

    const response = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, scopes: ["read", "write"] }),
    });
    const body = (await response.json()) as { key?: string; error?: string };
    if (!response.ok || !body.key) {
      setError(body.error ?? "Could not create API key.");
    } else {
      setCreatedKey(body.key);
      setName("");
    }
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="api-key-name">New API key</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Render worker or external API client"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" disabled={pending || !name.trim()} onClick={() => void createKey()}>
            {pending ? "Creating..." : "Create key"}
          </Button>
        </div>
      </div>

      {createdKey ? (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Copy this key now. It will not be shown again.</p>
          <code className="mt-2 block overflow-x-auto rounded bg-background p-2">{createdKey}</code>
          <div className="mt-2">
            <CopyButton text={createdKey} label="Copy API key" />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2 text-sm">
        {apiKeys.map((apiKey) => (
          <li key={apiKey.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="font-medium">{apiKey.name}</p>
              <p className="text-muted-foreground">
                {apiKey.key_prefix}... · {apiKey.scopes.join(", ")}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {apiKey.revoked_at ? "revoked" : apiKey.last_used_at ? "used" : "unused"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
