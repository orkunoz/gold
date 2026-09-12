import Link from "next/link";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShops } from "@/lib/admin/queries";
import { deleteShop } from "@/lib/admin/actions";

export const metadata = { title: "Shop administration" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [shops, { error }] = await Promise.all([getAdminShops(), searchParams]);
  return <section><Link href="/admin" className="text-sm text-stone-600">← Administration</Link><div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between"><h1 className="text-3xl font-semibold">Shops</h1><Link href="/admin/shops/new" className="w-full rounded-lg bg-stone-900 px-5 py-2.5 text-center text-sm font-medium text-white sm:w-auto">Create shop</Link></div>{error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p> : null}<div className="mt-6 overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Shop","Status","Accounts","Products","Actions"].map(heading => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{shops.map(shop => <tr key={shop.id}><td className="px-4 py-3 font-medium">{shop.name}</td><td className="px-4 py-3">{shop.is_active ? "Active" : "Inactive"}</td><td className="px-4 py-3">{shop.employee_count}</td><td className="px-4 py-3">{shop.in_stock_count}</td><td className="px-4 py-3"><div className="flex gap-3"><Link href={`/admin/shops/${shop.id}/edit`} className="font-medium hover:underline">Edit</Link><ConfirmActionButton action={deleteShop.bind(null,shop.id)} label="Delete" title="Delete shop permanently?" name={shop.name} message={"Products and accounts assigned to this shop will become Unassigned.\nHistorical sales will be preserved.\n\nThis action cannot be undone."} danger /></div></td></tr>)}</tbody></table></div></section>;
}
