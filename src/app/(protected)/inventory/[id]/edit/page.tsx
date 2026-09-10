import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryForm } from "@/components/inventory-form";
import { updateInventoryItem } from "@/lib/inventory/actions";
import { canManageInventory, getCurrentEmployee, getInventoryItem, getInventoryOptions } from "@/lib/inventory/queries";

export const metadata = { title: "Edit product" };

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, employee, options] = await Promise.all([getInventoryItem(id), getCurrentEmployee(), getInventoryOptions()]);
  if (!canManageInventory(employee.role)) redirect(`/inventory/${id}`);
  const action = updateInventoryItem.bind(null, id);
  return <section className="max-w-5xl">
    <Link href={`/inventory/${id}`} className="text-sm font-medium text-stone-600 hover:text-stone-900">← Product details</Link>
    <p className="mt-8 text-xs font-medium uppercase tracking-widest text-stone-500">Inventory record</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Edit product</h1>
    <p className="mt-2 break-all text-sm text-stone-600">Barcode: {item.barcode ?? "Not assigned"}</p>
    <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <InventoryForm action={action} {...options} item={item} cancelHref={`/inventory/${id}`} />
    </div>
  </section>;
}
