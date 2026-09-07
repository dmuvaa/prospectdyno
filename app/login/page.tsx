import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" description="Sign in to continue prospect research." footer={
      <>
        No account?{" "}
        <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </>
    }>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
