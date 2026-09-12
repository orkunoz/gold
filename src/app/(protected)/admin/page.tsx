import Link from "next/link";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  return <section>
    <div className="grid gap-5 sm:grid-cols-2">
      <Link href="/admin/employees" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Accounts</h2></Link>
      <Link href="/admin/shops" className="rounded-xl border bg-white p-6 hover:border-amber-700"><h2 className="text-xl font-semibold">Shops</h2></Link>
    </div>
  </section>;
}
