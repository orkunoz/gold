import Link from "next/link";
import { getAdminEmployees, getAdminShopRecords } from "@/lib/admin/queries";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const [shops, employees] = await Promise.all([getAdminShopRecords(), getAdminEmployees()]);
  const cards = [
    { label: "Active shops", value: shops.filter((shop) => shop.is_active).length },
    { label: "Active accounts", value: employees.filter((employee) => employee.is_active).length },
    { label: "Owners", value: employees.filter((employee) => employee.is_active && employee.role === "owner").length },
    { label: "Salespeople", value: employees.filter((employee) => employee.is_active && employee.role === "salesperson").length },
  ];

  return <section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="rounded-xl border bg-white p-5"><p className="text-xs uppercase text-stone-500">{card.label}</p><p className="mt-2 text-3xl font-semibold">{card.value}</p></div>)}
    </div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      <Link href="/admin/shops" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Shops</h2></Link>
      <Link href="/admin/employees" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Accounts</h2></Link>
    </div>
  </section>;
}
