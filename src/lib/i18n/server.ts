import "server-only";
import { cookies } from "next/headers";
import { createTranslator, LANGUAGE_COOKIE, normalizeLocale } from "./core";

export async function getLocale() {
  return normalizeLocale((await cookies()).get(LANGUAGE_COOKIE)?.value);
}

export async function getTranslations() {
  const locale = await getLocale();
  return { locale, t: createTranslator(locale) };
}
