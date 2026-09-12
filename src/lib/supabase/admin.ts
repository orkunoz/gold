import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "./env";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Account administration is not configured. Add the server-only SUPABASE_SERVICE_ROLE_KEY.");
  return createClient<Database>(getSupabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
