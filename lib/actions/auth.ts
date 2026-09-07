"use server";

import { createServerSupabaseClient } from "@prospectdyno/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
