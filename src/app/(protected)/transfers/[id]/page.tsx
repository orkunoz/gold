import Link from "next/link";
import { TransferNote, type TransferNoteLabels } from "@/components/transfer-note";
import { getTransfer } from "@/lib/transfers/queries";
import { getTranslations } from "@/lib/i18n/server";

export default async function TransferPage({params}:{params:Promise<{id:string}>}) {
  const [{id},{t,locale}]=await Promise.all([params,getTranslations()]);
  const {transfer,items}=await getTransfer(id);
  const labels:TransferNoteLabels={title:locale==="ua"?"Накладна переміщення":"Transfer Note",number:t("transfers.number"),date:t("fields.date"),from:t("transfers.from"),to:t("transfers.to"),itemCount:t("transfers.items"),totalWeight:t("transfers.totalWeight"),totalValue:t("transfers.totalValue"),performedBy:t("transfers.performedBy"),sender:locale==="ua"?"Передав":"Sent by",receiver:locale==="ua"?"Прийняв":"Received by",headings:[t("fields.number"),t("fields.productCategory"),t("fields.article"),t("fields.producer"),t("fields.size"),t("fields.weight"),t("fields.purchasePrice"),t("fields.pricePerGram"),t("fields.priceUah"),t("fields.barcode")]};
  return <section><div className="transfer-note-actions mx-auto mb-4 flex max-w-6xl justify-end"><Link className="rounded border border-amber-800 bg-white px-4 py-2 text-amber-900" href={`/api/transfers/${id}/pdf`}>{t("transfers.downloadPdf")}</Link></div><TransferNote transfer={transfer} items={items} labels={labels} locale={locale} logoSrc="/zlata-logo.png"/></section>;
}
