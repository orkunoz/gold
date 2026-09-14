import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getClaims = cache(async () => {
  const supabase = await createClient();
  let result = await supabase.auth.getClaims();
  let attempt = 1;
  if (result.error && (result.error.status === 408 || result.error.status === 429 || (result.error.status ?? 0) >= 500)) {
    console.error("auth_claims_failure", { attempt: 1, name: result.error.name, status: result.error.status ?? null });
    attempt = 2;
    result = await supabase.auth.getClaims();
  }
  if (result.error) {
    console.error("auth_claims_failure", { attempt, name: result.error.name, status: result.error.status ?? null });
    throw new Error("Unable to verify the current session.");
  }
  return result.data?.claims ?? null;
});

export async function requireUser() {
  const claims = await getClaims();
  if (!claims?.sub) redirect("/login");
  return claims;
}
