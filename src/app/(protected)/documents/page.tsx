import Link from "next/link";
import { getAddedProductDocuments } from "@/lib/added-products/queries";
import { formatPrice } from "@/lib/inventory/format";
import { getTranslations } from "@/lib/i18n/server";
import { historicalLocationDisplayName } from "@/lib/locations/display";
import { getTransfers } from "@/lib/transfers/queries";
import { PageHeading } from "@/components/ui/page-heading";
import { buttonStyles } from "@/components/ui/button";

const identifierClass = "whitespace-nowrap font-semibold text-amber-800 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-950";
const downloadClass = "whitespace-nowrap font-medium text-amber-900 underline underline-offset-4";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const type = (await searchParams).type === "added" ? "added" : "transfers";
  const [{ t, locale }, rows] = await Promise.all([getTranslations(), type === "added" ? getAddedProductDocuments() : getTransfers()]);
  const date = (value: string) => new Intl.DateTimeFormat(locale === "ua" ? "uk-UA" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));

  return <section>
    <PageHeading title={t("documents.title")} />
    <nav className="mt-5 flex gap-2" aria-label={t("documents.types")}>
      <Link className={buttonStyles(type === "transfers" ? "primary" : "secondary")} href="/documents?type=transfers">{t("transfers.title")}</Link>
      <Link className={buttonStyles(type === "added" ? "primary" : "secondary")} href="/documents?type=added">{t("addedProducts.title")}</Link>
    </nav>
    <div className="zl-table-wrap mt-4">
      {type === "transfers" ? <table className="zl-table min-w-[1050px]">
        <thead><tr><th>{t("transfers.number")}</th><th>{t("fields.createdDate")}</th><th>{t("documents.createdBy")}</th><th>{t("transfers.from")}</th><th>{t("transfers.to")}</th><th className="zl-table-number">{t("transfers.items")}</th><th className="zl-table-number">{t("transfers.totalWeight")}</th><th className="zl-table-number">{t("transfers.totalValue")}</th><th>{t("documents.actions")}</th></tr></thead>
        <tbody>{(rows as Awaited<ReturnType<typeof getTransfers>>).map(row => <tr key={row.id}>
          <td><Link className={identifierClass} href={`/transfers/${row.id}`}>{row.transfer_number}</Link></td><td className="whitespace-nowrap">{date(row.transferred_at)}</td><td>{row.performed_by_name}</td>
          <td>{historicalLocationDisplayName(row.source_name, locale)}</td><td>{historicalLocationDisplayName(row.destination_name, locale)}</td><td className="zl-table-number">{row.item_count}</td>
          <td className="zl-table-number whitespace-nowrap">{row.total_weight} g</td><td className="zl-table-number whitespace-nowrap">{formatPrice(row.total_value, locale)}</td><td><a className={downloadClass} href={`/api/transfers/${row.id}/pdf`} download>{t("transfers.downloadPdf")}</a></td>
        </tr>)}</tbody>
      </table> : <table className="zl-table min-w-[900px]">
        <thead><tr><th>{t("documents.documentNumber")}</th><th>{t("fields.createdDate")}</th><th>{t("documents.createdBy")}</th><th className="zl-table-number">{t("addedProducts.products")}</th><th className="zl-table-number">{t("addedProducts.totalWeight")}</th><th className="zl-table-number">{t("addedProducts.totalValue")}</th><th>{t("documents.actions")}</th></tr></thead>
        <tbody>{(rows as Awaited<ReturnType<typeof getAddedProductDocuments>>).map(row => <tr key={row.id}>
          <td><Link className={identifierClass} href={`/documents/added-products/${row.id}`}>{row.document_number}</Link></td><td className="whitespace-nowrap">{date(row.created_at)}</td><td>{row.created_by_name}</td>
          <td className="zl-table-number">{row.product_count}</td><td className="zl-table-number whitespace-nowrap">{row.total_weight} g</td><td className="zl-table-number whitespace-nowrap">{formatPrice(row.total_value, locale)}</td><td><a className={downloadClass} href={`/api/added-products/${row.id}/pdf`} download>{t("addedProducts.downloadPdf")}</a></td>
        </tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
