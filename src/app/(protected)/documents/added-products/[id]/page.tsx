import {AddedProductsNote} from "@/components/added-products-note";
import Link from "next/link";
import {addedProductsInAppLabels} from "@/lib/added-products/labels";
import {getAddedProductDocument} from "@/lib/added-products/queries";
import {getTranslations} from "@/lib/i18n/server";
import {formatTablePrice} from "@/lib/inventory/format";
import {localeTag} from "@/lib/i18n/core";

export default async function AddedProductsDocumentPage({params}:{params:Promise<{id:string}>}){
 const[{id},{t,locale}]=await Promise.all([params,getTranslations()]),{document,items}=await getAddedProductDocument(id);
 const number=new Intl.NumberFormat(localeTag(locale),{maximumFractionDigits:3}),weight=(value:number)=>`${number.format(value)} ${t("common.grams")}`;
 return <section><div className="transfer-note-actions mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4"><Link href="/documents?type=added" className="text-sm font-semibold text-stone-600 transition-colors hover:text-stone-900">← {t("addedProducts.title")}</Link><a className="rounded border border-amber-800 bg-white px-4 py-2 text-amber-900" href={`/api/added-products/${id}/pdf`} download>{t("addedProducts.downloadPdf")}</a></div><AddedProductsNote document={document} items={items} labels={addedProductsInAppLabels(t,locale)} locale={locale} logoSrc="/logoZlataBrown.png" presentation={{formatPrice:value=>formatTablePrice(value,locale),formatWeight:weight}}/></section>;
}
