import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : data?.claims ?? null;
});

export async function requireUser() {
  const claims = await getClaims();
  if (!claims?.sub) redirect("/login");
  return claims;
}
