import Link from "next/link";
import {ConfirmActionButton} from "@/components/confirm-action-button";
import {getAdminData} from "@/lib/admin/queries";
import {setShopActive} from "@/lib/admin/actions";
import {formatDate} from "@/lib/inventory/format";

export const metadata={title:"Shop administration"};

export default async function ShopsPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const[{shops},{error}]=await Promise.all([getAdminData(),searchParams]);
  return <section>
    <Link href="/admin" className="text-sm text-stone-600">← Administration</Link>
    <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-semibold">Shops</h1><p className="mt-2 text-sm text-stone-600">Inactive shops remain visible in historical records.</p></div>
      <Link href="/admin/shops/new" className="w-full rounded-lg bg-stone-900 px-5 py-2.5 text-center text-sm font-medium text-white sm:w-auto">Create shop</Link>
    </div>
    {error?<p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>:null}
    <div className="mt-6 overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Name","Code","Status","Accounts","In stock","Created","Actions"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{shops.map(shop=><tr key={shop.id}><td className="px-4 py-3 font-medium">{shop.name}</td><td className="px-4 py-3">{shop.code}</td><td className="px-4 py-3">{shop.is_active?"Active":"Inactive"}</td><td className="px-4 py-3">{shop.employee_count}</td><td className="px-4 py-3">{shop.in_stock_count}</td><td className="px-4 py-3">{formatDate(shop.created_at)}</td><td className="px-4 py-3"><div className="flex gap-3"><Link href={`/admin/shops/${shop.id}/edit`} className="font-medium hover:underline">Edit</Link><ConfirmActionButton action={setShopActive.bind(null,shop.id,!shop.is_active)} label={shop.is_active?"Deactivate":"Activate"} message={shop.is_active?"Deactivate this shop? This is blocked while active accounts or in-stock inventory remain.":"Activate this shop?"} danger={shop.is_active}/></div></td></tr>)}</tbody></table></div>
  </section>;
}
