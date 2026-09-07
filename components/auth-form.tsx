"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "register" | "forgot-password";
const AUTH_TIMEOUT_MS = 20_000;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const prompt = searchParams.get("q");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const firstName = String(form.get("first_name") ?? "").trim();
    const lastName = String(form.get("last_name") ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const supabase = createBrowserSupabaseClient();

    try {
      if (mode === "forgot-password") {
        const redirectTo = authRedirectUrl("/update-password");
        const { error: resetError } = await withAuthTimeout(
          supabase.auth.resetPasswordForEmail(email, { redirectTo }),
        );
        if (resetError) throw resetError;
        setMessage("Check your email for a reset link.");
        return;
      }

      if (mode === "register") {
        const destination = prompt
          ? `/onboarding?q=${encodeURIComponent(prompt)}`
          : "/onboarding";
        const redirectTo = authRedirectUrl(destination);
        const { data, error: signUpError } = await withAuthTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName,
                full_name: fullName,
              },
              emailRedirectTo: redirectTo,
            },
          }),
        );
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then continue setup.");
          return;
        }
        router.replace(destination);
        router.refresh();
        return;
      }

      const { error: signInError } = await withAuthTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
      );
      if (signInError) throw signInError;
      router.replace(next || "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  function authRedirectUrl(destination: string) {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", destination);
    return url.toString();
  }

  async function withAuthTimeout<T>(promise: PromiseLike<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Authentication is taking too long. Check your Supabase URL, redirect URLs, and Vercel environment variables."));
      }, AUTH_TIMEOUT_MS);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "register" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" name="first_name" autoComplete="given-name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" name="last_name" autoComplete="family-name" required />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {mode !== "forgot-password" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" ? (
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}

      <Button type="submit" variant="ink" className="w-full" disabled={pending}>
        {pending
          ? "Please wait..."
          : mode === "register"
            ? "Create account"
            : mode === "forgot-password"
              ? "Send reset link"
              : "Sign in"}
      </Button>
    </form>
  );
}
