import type {Locale} from "@/lib/i18n/core";
import {localeTag} from "@/lib/i18n/core";

const DOCUMENT_TIME_ZONE="Europe/Kyiv";

export function formatDocumentDateTime(value:string,locale:Locale){
 return new Intl.DateTimeFormat(localeTag(locale),{dateStyle:"medium",timeStyle:"short",timeZone:DOCUMENT_TIME_ZONE}).format(new Date(value));
}

export function documentWeightUnit(locale:Locale){return locale==="ua"?"г":"g"}
