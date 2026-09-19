import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/inventory/:path*", "/sales/:path*", "/documents/:path*", "/transfers/:path*", "/api/added-products/:path*", "/api/transfers/:path*", "/admin/:path*"],
};
