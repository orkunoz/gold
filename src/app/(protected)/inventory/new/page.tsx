import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryForm } from "@/components/inventory-form";
import { createInventoryItem } from "@/lib/inventory/actions";
import { canManageInventory, getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";

export const metadata = { title: "Add product" };

export default async function NewInventoryItemPage() {
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  if (!canManageInventory(employee.role)) redirect("/inventory");
  return <section className="max-w-5xl">
    <Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← Inventory</Link>
    <p className="mt-8 text-xs font-medium uppercase tracking-widest text-stone-500">Manual intake</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Add product</h1>
    <p className="mt-2 text-sm text-stone-600">Create one record for one physical jewelry piece.</p>
    <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <InventoryForm action={createInventoryItem} {...options} cancelHref="/inventory" />
    </div>
  </section>;
}
