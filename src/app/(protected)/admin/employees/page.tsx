import Link from "next/link";
import { getAdminData } from "@/lib/admin/queries";
import { formatDate } from "@/lib/inventory/format";

export const metadata = { title: "Account administration" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ employees, shops }, filters] = await Promise.all([getAdminData(), searchParams]);
  const shown = employees.filter((employee) =>
    (!filters.status || (filters.status === "active") === employee.is_active)
    && (!filters.role || employee.role === filters.role)
    && (!filters.shop || employee.shop_id === filters.shop));

  return <section>
    <Link href="/admin" className="text-sm text-stone-600">← Administration</Link>
    <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-semibold">Accounts</h1><p className="mt-2 text-sm text-stone-600">Login identities are linked to staff records and are never editable.</p></div>
      <Link href="/admin/employees/invite" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Create account</Link>
    </div>
    <form className="mt-6 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
      <select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border px-3 py-2"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select name="role" defaultValue={filters.role ?? ""} className="rounded-lg border px-3 py-2"><option value="">All roles</option><option value="owner">Owner</option><option value="salesperson">Salesperson</option></select>
      <select name="shop" defaultValue={filters.shop ?? ""} className="rounded-lg border px-3 py-2"><option value="">All shops</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>
      <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">Filter</button>
    </form>
    <div className="mt-6 overflow-x-auto rounded-xl border bg-white" aria-label="Accounts">
      {shown.length ? <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Name", "Username", "Role", "Shop", "Status", "Created", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{shown.map((employee) => <tr key={employee.id}><td className="px-4 py-3 font-medium">{employee.full_name || "Unnamed account"}</td><td className="px-4 py-3">{employee.username || "Legacy account"}</td><td className="px-4 py-3 capitalize">{employee.role}</td><td className="px-4 py-3">{employee.shops?.name || "—"}</td><td className="px-4 py-3">{employee.is_active ? "Active" : "Inactive"}</td><td className="px-4 py-3">{formatDate(employee.created_at)}</td><td className="px-4 py-3"><Link href={`/admin/employees/${employee.id}/edit`} className="font-medium text-amber-900 hover:underline">Edit</Link></td></tr>)}</tbody></table> : <p className="p-10 text-center text-sm text-stone-500">No accounts match these filters.</p>}
    </div>
  </section>;
}
