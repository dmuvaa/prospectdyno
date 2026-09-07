import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { getWorkspaceContext } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspace } = await getWorkspaceContext();
  const { q } = await searchParams;

  if (workspace) {
    redirect(q ? `/icps/new?q=${encodeURIComponent(q)}` : "/dashboard");
  }

  const next = q ? `/icps/new?q=${encodeURIComponent(q)}` : "/dashboard";

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="font-heading mt-8 text-3xl">Name your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is the home for your ICPs, searches, and opportunities.
        </p>
        <OnboardingForm next={next} />
      </div>
    </div>
  );
}
