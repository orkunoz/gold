import {DocumentDetailView} from "@/components/document-detail-view";
import {getAddedProductDocument} from "@/lib/added-products/queries";
import {getTranslations} from "@/lib/i18n/server";
import {displayValue,formatDateTime,formatTablePrice} from "@/lib/inventory/format";
import {localeTag} from "@/lib/i18n/core";
import {historicalLocationDisplayName} from "@/lib/locations/display";

export default async function AddedProductsDocumentPage({params}:{params:Promise<{id:string}>}){
 const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{document,items}=await getAddedProductDocument(id);
 const number=new Intl.NumberFormat(localeTag(locale),{maximumFractionDigits:3}),weight=(value:number)=>`${number.format(value)} ${t("common.grams")}`;
 return <DocumentDetailView backHref="/documents?type=added" backLabel={t("addedProducts.title")} title={t("addedProducts.noteTitle")} documentNumber={document.document_number} downloadHref={`/api/added-products/${id}/pdf`} downloadLabel={t("addedProducts.downloadPdf")}
  details={[{label:t("fields.createdDate"),value:formatDateTime(document.created_at,locale)},{label:t("documents.createdBy"),value:document.created_by_name},{label:t("addedProducts.locations"),value:document.location_names.map(value=>historicalLocationDisplayName(value,locale)).join(", ")}]}
  headings={[t("fields.number"),t("fields.productCategory"),t("fields.article"),t("fields.producer"),t("fields.size"),t("fields.weight"),t("fields.pricePerGram"),t("fields.priceUah"),t("fields.shop"),t("fields.barcode")]}
  rows={items.map(item=>[item.line_number,displayValue(item.category_name),displayValue(item.article_number),displayValue(item.producer),displayValue(item.size),weight(item.weight_grams),formatTablePrice(item.price_per_gram,locale),formatTablePrice(item.price,locale),historicalLocationDisplayName(item.location_name,locale),displayValue(item.barcode)])}
  numericColumns={[0,5,6,7]} summary={[{label:t("addedProducts.products"),value:document.product_count},{label:t("addedProducts.totalWeight"),value:weight(document.total_weight)},{label:t("documents.inAppTotalValue"),value:formatTablePrice(document.total_value,locale)}]}/>;
}
