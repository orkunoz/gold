import type {Locale} from "@/lib/i18n/core";
import {localeTag} from "@/lib/i18n/core";

const DOCUMENT_TIME_ZONE="Europe/Kyiv";

export function formatDocumentDateTime(value:string,locale:Locale){
 return new Intl.DateTimeFormat(localeTag(locale),{dateStyle:"medium",timeStyle:"short",timeZone:DOCUMENT_TIME_ZONE}).format(new Date(value));
}

export function documentWeightUnit(locale:Locale){return locale==="ua"?"г":"g"}

function normalizedMoney(value:number){return Math.abs(value)<0.005?0:value}
function ukrainianMoney(value:number){return `${new Intl.NumberFormat("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2}).format(normalizedMoney(value))} ₴`}

export function formatDocumentPrice(value:number|null,locale:Locale){
 if(value===null)return "—";
 if(locale==="ua")return ukrainianMoney(value);
 return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(normalizedMoney(value));
}

export function formatDocumentTotalPrice(value:number|null,locale:Locale){
 if(value===null)return "—";
 if(locale==="ua")return ukrainianMoney(value);
 return new Intl.NumberFormat("en-US",{style:"currency",currency:"UAH",maximumFractionDigits:2}).format(normalizedMoney(value));
}
