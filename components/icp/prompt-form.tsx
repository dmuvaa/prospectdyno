"use client";

import { useState } from "react";
import { interpretAndCreateIcp } from "@/lib/actions/icp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function IcpPromptForm({
  defaultPrompt,
  examples,
}: {
  defaultPrompt: string;
  examples: string[];
}) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await interpretAndCreateIcp(prompt);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Find SaaS companies in Europe with 20–200 employees that sell cybersecurity products to enterprise customers."
        className="min-h-[160px] rounded-2xl bg-card px-4 py-3 text-base"
        required
        minLength={8}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ink" size="lg" disabled={pending}>
          {pending ? "Interpreting…" : "Interpret ICP"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Nothing is searched until you confirm the criteria.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            className="max-w-full rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground hover:border-teal-700/30 hover:text-foreground"
          >
            {example.length > 88 ? `${example.slice(0, 88)}…` : example}
          </button>
        ))}
      </div>
    </form>
  );
}
