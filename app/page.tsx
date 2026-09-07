import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import { getUser } from "@/lib/workspace";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await getUser();
  const params = await searchParams;
  const destination = user ? "/icps/new" : "/register";

  return (
    <div className="min-h-full">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3">
          {user ? (
            <Button asChild variant="ink">
              <Link href="/dashboard">Open workspace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="ink">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-10 sm:pt-20">
        <p className="mb-4 text-sm font-medium tracking-wide text-teal-800 uppercase">
          AI prospect intelligence
        </p>
        <h1 className="font-heading max-w-3xl text-4xl leading-tight text-ink sm:text-6xl">
          Describe who you want. ProspectDyno finds the opportunities.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Natural-language ICP, evidence-backed qualification, and a clear opportunity
          report — without a giant proprietary database.
        </p>

        <form action={destination} className="mt-10">
          <label htmlFor="q" className="sr-only">
            Who are you looking for?
          </label>
          <textarea
            id="q"
            name="q"
            defaultValue={params.q}
            required
            minLength={8}
            rows={5}
            placeholder="Find US and UK digital marketing agencies with 5–50 employees that offer local SEO…"
            className="w-full resize-y rounded-2xl border border-border bg-card px-5 py-4 text-base shadow-sm outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="ink" size="lg">
              {user ? "Interpret this ICP" : "Start with this description"}
              <ArrowRight />
            </Button>
            <p className="text-sm text-muted-foreground">
              You will review the interpretation before any search runs.
            </p>
          </div>
        </form>

        <div className="mt-8 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <Link
              key={prompt}
              href={`${destination}?q=${encodeURIComponent(prompt)}`}
              className="max-w-full rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-teal-700/30 hover:text-foreground"
            >
              {prompt.length > 92 ? `${prompt.slice(0, 92)}…` : prompt}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
