import { SalesCheckout } from "@/components/sales-checkout";
import { getCurrentEmployee, getInventoryOptions } from "@/lib/inventory/queries";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const [employee, options] = await Promise.all([getCurrentEmployee(), getInventoryOptions()]);
  return <section>
    <div className="page-intro">
      <p className="eyebrow">Sales workspace</p>
      <h1>Checkout</h1>
      <p>Scan physical items, apply a discount, and complete the sale securely.</p>
    </div>
    <div className="mt-8"><SalesCheckout employee={employee} shops={options.shops} /></div>
  </section>;
}
