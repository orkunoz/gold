import Link from "next/link";
import { redirect } from "next/navigation";
import { InventoryImport } from "@/components/inventory-import";
import { canManageInventory, getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";

export const metadata = { title: "Import inventory" };

export default async function ImportInventoryPage() {
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  if (!canManageInventory(employee.role)) redirect("/inventory");
  return <section className="max-w-6xl"><Link href="/inventory" className="text-sm font-medium text-stone-600 hover:text-stone-900">← Inventory</Link><p className="mt-8 text-xs font-medium uppercase tracking-widest text-stone-500">Excel intake</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Import inventory</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Upload, map, validate, and review every row before anything is added to inventory.</p><div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><InventoryImport employeeShopId={employee.shop_id} shops={options.shops} /></div></section>;
}
