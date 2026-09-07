import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@prospectdyno/supabase/middleware";

const protectedPrefixes = [
  "/dashboard",
  "/icps",
  "/searches",
  "/prospects",
  "/opportunities",
  "/lists",
  "/campaigns",
  "/settings",
  "/onboarding",
  "/update-password",
];
const authPrefixes = ["/login", "/register", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = authPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
