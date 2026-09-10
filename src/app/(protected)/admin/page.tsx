import Link from "next/link";
import { getAdminData } from "@/lib/admin/queries";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const { shops, employees } = await getAdminData();
  const cards = [
    { label: "Active shops", value: shops.filter((shop) => shop.is_active).length },
    { label: "Active employees", value: employees.filter((employee) => employee.is_active).length },
    { label: "Owners", value: employees.filter((employee) => employee.is_active && employee.role === "owner").length },
    { label: "Salespeople", value: employees.filter((employee) => employee.is_active && employee.role === "salesperson").length },
  ];

  return <section>
    <p className="text-xs uppercase tracking-widest text-stone-500">Owner workspace</p>
    <h1 className="mt-3 text-3xl font-semibold">Administration</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="rounded-xl border bg-white p-5"><p className="text-xs uppercase text-stone-500">{card.label}</p><p className="mt-2 text-3xl font-semibold">{card.value}</p></div>)}
    </div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      <Link href="/admin/shops" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Shops</h2><p className="mt-2 text-sm text-stone-600">Create, edit, activate, and safely deactivate shops.</p></Link>
      <Link href="/admin/employees" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Employees</h2><p className="mt-2 text-sm text-stone-600">Invite staff and manage roles, shops, and access.</p></Link>
    </div>
  </section>;
}
