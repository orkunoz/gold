"use client";
import { createContext, useContext } from "react";
import { createTranslator, type Locale } from "@/lib/i18n/core";

const I18nContext = createContext<Locale>("ua");
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) { return <I18nContext value={locale}>{children}</I18nContext>; }
export function useI18n() { const locale = useContext(I18nContext); return { locale, t: createTranslator(locale) }; }
