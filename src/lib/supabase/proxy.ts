import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import type { Database } from "../database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  let signedIn = !error && Boolean(data?.claims?.sub);
  if (signedIn) {
    const { data: employee } = await supabase.from("employees").select("is_active").eq("auth_user_id", String(data?.claims?.sub)).maybeSingle();
    if (!employee?.is_active) {
      await supabase.auth.signOut({ scope: "local" });
      signedIn = false;
    }
  }
  const pathname = request.nextUrl.pathname;
  const login = pathname === "/login";
  if ((!signedIn && !login) || (signedIn && login)) {
    const destination = request.nextUrl.clone();
    destination.pathname = signedIn ? "/dashboard" : "/login";
    destination.search = "";
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  // Authenticated responses and refreshed cookies must never be shared by a CDN.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
