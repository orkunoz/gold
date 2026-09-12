import { NextResponse } from "next/server";
import { LANGUAGE_COOKIE, normalizeLocale } from "@/lib/i18n/core";

export async function POST(request: Request) {
  let value: unknown;
  try { value = (await request.json() as { locale?: unknown }).locale; } catch { value = undefined; }
  const response = NextResponse.json({ locale: normalizeLocale(typeof value === "string" ? value : undefined) });
  response.cookies.set(LANGUAGE_COOKIE, normalizeLocale(typeof value === "string" ? value : undefined), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return response;
}
