import { SalesCheckout } from "@/components/sales-checkout";
import { getActiveShops, getCurrentEmployee } from "@/lib/inventory/queries";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const [employee, shops] = await Promise.all([getCurrentEmployee(), getActiveShops()]);
  return <section><SalesCheckout employee={employee} shops={shops} /></section>;
}
