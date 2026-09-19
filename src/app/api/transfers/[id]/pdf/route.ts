import {getTranslations} from "@/lib/i18n/server";
import {historicalLocationDisplayName} from "@/lib/locations/display";
import {transferNoteLabels} from "@/lib/transfers/labels";
import {transferPdf,transferPdfFilename} from "@/lib/transfers/pdf";
import {getTransfer} from "@/lib/transfers/queries";
export const runtime="nodejs";export const maxDuration=60;
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{transfer,items}=await getTransfer(id),displayTransfer={...transfer,source_name:historicalLocationDisplayName(transfer.source_name,locale),destination_name:historicalLocationDisplayName(transfer.destination_name,locale)},pdf=await transferPdf(displayTransfer,items,transferNoteLabels(t),locale);return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${transferPdfFilename(transfer.transfer_number)}"`,"Content-Length":String(pdf.byteLength),"Cache-Control":"private, no-store"}})}
