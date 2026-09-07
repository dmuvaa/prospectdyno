import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="We will email you a link to choose a new password."
      footer={
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense>
        <AuthForm mode="forgot-password" />
      </Suspense>
    </AuthShell>
  );
}
