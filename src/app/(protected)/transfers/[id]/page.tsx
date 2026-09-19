import {TransferNote} from "@/components/transfer-note";
import {getTranslations} from "@/lib/i18n/server";
import {historicalLocationDisplayName} from "@/lib/locations/display";
import {transferNoteLabels} from "@/lib/transfers/labels";
import {getTransfer} from "@/lib/transfers/queries";

export default async function TransferPage({params}:{params:Promise<{id:string}>}){
 const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{transfer,items}=await getTransfer(id),displayTransfer={...transfer,source_name:historicalLocationDisplayName(transfer.source_name,locale),destination_name:historicalLocationDisplayName(transfer.destination_name,locale)};
 return <section><div className="transfer-note-actions mx-auto mb-4 flex max-w-6xl justify-end"><a className="rounded border border-amber-800 bg-white px-4 py-2 text-amber-900" href={`/api/transfers/${id}/pdf`} download>{t("transfers.downloadPdf")}</a></div><TransferNote transfer={displayTransfer} items={items} labels={transferNoteLabels(t)} locale={locale} logoSrc="/logoZlataBrown.png"/></section>;
}
