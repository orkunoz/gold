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
    <h1 className="mt-6 text-3xl font-semibold tracking-tight">Add product</h1>
    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <InventoryForm action={createInventoryItem} {...options} cancelHref="/inventory" />
    </div>
  </section>;
}
