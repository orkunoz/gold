import {DocumentDetailView} from "@/components/document-detail-view";
import {getTranslations} from "@/lib/i18n/server";
import {displayValue,formatDateTime,formatTablePrice} from "@/lib/inventory/format";
import {localeTag} from "@/lib/i18n/core";
import {historicalLocationDisplayName} from "@/lib/locations/display";
import {getTransfer} from "@/lib/transfers/queries";

export default async function TransferPage({params}:{params:Promise<{id:string}>}){
 const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{transfer,items}=await getTransfer(id);
 const number=new Intl.NumberFormat(localeTag(locale),{maximumFractionDigits:3}),weight=(value:number)=>`${number.format(value)} ${t("common.grams")}`;
 return <DocumentDetailView backHref="/documents?type=transfers" backLabel={t("transfers.title")} title={t("transfers.noteTitle")} documentNumber={transfer.transfer_number} downloadHref={`/api/transfers/${id}/pdf`} downloadLabel={t("transfers.downloadPdf")}
  details={[{label:t("fields.createdDate"),value:formatDateTime(transfer.transferred_at,locale)},{label:t("transfers.from"),value:historicalLocationDisplayName(transfer.source_name,locale)},{label:t("transfers.to"),value:historicalLocationDisplayName(transfer.destination_name,locale)},{label:t("documents.createdBy"),value:transfer.performed_by_name}]}
  headings={[t("fields.number"),t("fields.productCategory"),t("fields.article"),t("fields.producer"),t("fields.size"),t("fields.weight"),t("fields.pricePerGram"),t("fields.priceUah"),t("fields.barcode")]}
  rows={items.map(item=>[item.line_number,displayValue(item.category_name),displayValue(item.article_number),displayValue(item.producer),displayValue(item.size),item.weight_grams===null?"—":weight(item.weight_grams),formatTablePrice(item.price_per_gram,locale),formatTablePrice(item.price,locale),displayValue(item.barcode)])}
  numericColumns={[0,5,6,7]} summary={[{label:t("transfers.items"),value:transfer.item_count},{label:t("transfers.totalWeight"),value:weight(transfer.total_weight)},{label:t("documents.inAppTotalValue"),value:formatTablePrice(transfer.total_value,locale)}]}/>;
}
