import { SalesCheckout } from "@/components/sales-checkout";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  return <section><SalesCheckout employee={employee} shops={options.shops} /></section>;
}
