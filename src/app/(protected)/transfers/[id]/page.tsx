import {TransferNote} from "@/components/transfer-note";
import Link from "next/link";
import {getTranslations} from "@/lib/i18n/server";
import {formatTablePrice} from "@/lib/inventory/format";
import {localeTag} from "@/lib/i18n/core";
import {historicalLocationDisplayName} from "@/lib/locations/display";
import {transferInAppLabels} from "@/lib/transfers/labels";
import {getTransfer} from "@/lib/transfers/queries";

export default async function TransferPage({params}:{params:Promise<{id:string}>}){
 const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{transfer,items}=await getTransfer(id),displayTransfer={...transfer,source_name:historicalLocationDisplayName(transfer.source_name,locale),destination_name:historicalLocationDisplayName(transfer.destination_name,locale)};
 const number=new Intl.NumberFormat(localeTag(locale),{maximumFractionDigits:3}),weight=(value:number)=>`${number.format(value)} ${t("common.grams")}`;
 return <section><div className="transfer-note-actions mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4"><Link href="/documents?type=transfers" className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900">← {t("transfers.title")}</Link><a className="rounded border border-amber-800 bg-white px-4 py-2 text-amber-900" href={`/api/transfers/${id}/pdf`} download>{t("transfers.downloadPdf")}</a></div><TransferNote transfer={displayTransfer} items={items} labels={transferInAppLabels(t)} locale={locale} logoSrc="/logoZlataBrown.png" presentation={{formatPrice:value=>formatTablePrice(value,locale),formatWeight:weight}}/></section>;
}
