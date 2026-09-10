"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeRole } from "@/lib/database.types";
import { completeSaleAction, type SaleConfirmation } from "@/lib/sales/actions";
import { addProductToCart, buildSaleRpcItems, cartTotal, checkoutShopLocked, checkoutShops, normalizeSalesBarcode, parseDiscountPercent, parseSalePrice, removeCartItem, updateCartDiscount, updateCartPrice, type CartItem, type CheckoutProduct } from "@/lib/sales/checkout";
import { formatPrice } from "@/lib/inventory/format";
import { InventoryStatus } from "@/components/inventory-status";
import { effectivePriceSourceLabel } from "@/lib/pricing/model";

type Shop = { id: string; name: string };

export function SalesCheckout({ employee, shops }: { employee: { full_name: string | null; role: EmployeeRole; shop_id: string | null }; shops: Shop[] }) {
  const availableShops = checkoutShops(employee.role, employee.shop_id, shops);
  const [shopId, setShopId] = useState(employee.role === "owner" ? availableShops[0]?.id ?? "" : employee.shop_id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [confirmation, setConfirmation] = useState<SaleConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();
  const scannerRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { scannerRef.current?.focus(); }, [confirmation]);

  function refocusScanner(select = false) {
    requestAnimationFrame(() => {
      scannerRef.current?.focus();
      if (select) scannerRef.current?.select();
    });
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const barcode = normalizeSalesBarcode(scannerRef.current?.value ?? "");
    if (!barcode) { refocusScanner(); return; }
    if (isLookingUp || isPending) return;
    if (!shopId) { setMessage("Select a shop before scanning."); refocusScanner(true); return; }
    setMessage("Looking up barcode…");
    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/sales/lookup?barcode=${encodeURIComponent(barcode)}&shop_id=${encodeURIComponent(shopId)}`);
      const payload = await response.json() as { item?: CheckoutProduct; error?: string };
      if (!response.ok || !payload.item) {
        setMessage(response.status === 404 ? "Barcode not found." : payload.error ?? "Barcode lookup failed.");
        refocusScanner(true);
        return;
      }
      const result = addProductToCart(cart, payload.item);
      setCart(result.cart);
      setMessage(result.error ?? `${payload.item.barcode} added to the current sale.`);
      if (scannerRef.current) scannerRef.current.value = "";
      refocusScanner(result.error !== null);
    } catch {
      setMessage("Barcode lookup failed. Check the connection and try again.");
      refocusScanner(true);
    } finally {
      setIsLookingUp(false);
    }
  }

  function changeShop(nextShopId: string) {
    setShopId(nextShopId);
    setCart([]);
    setConfirmation(null);
    setMessage(cart.length ? "The current sale was cleared because the shop changed." : null);
    refocusScanner();
  }

  function complete() {
    const rpcItems = buildSaleRpcItems(cart);
    if (rpcItems.error || !rpcItems.value) { setMessage(rpcItems.error); return; }
    if (notes.length > 5000) { setMessage("Sale notes cannot exceed 5000 characters."); return; }
    setMessage(null);
    startTransition(async () => {
      const result = await completeSaleAction({ shopId, items: rpcItems.value!, notes: notes.trim() || null });
      if (!result.success) { setMessage(result.error); refocusScanner(); return; }
      setCart([]);
      setNotes("");
      setConfirmation(result.sale);
      router.refresh();
    });
  }

  if (confirmation) return <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Sale completed</p>
    <h2 className="mt-3 text-2xl font-semibold">{confirmation.sale_number}</h2>
    <dl className="mt-5 grid gap-4 sm:grid-cols-3">
      <div><dt className="text-xs uppercase text-stone-500">Date</dt><dd className="mt-1 font-medium">{new Date(confirmation.sold_at).toLocaleString("en-UA")}</dd></div>
      <div><dt className="text-xs uppercase text-stone-500">Items</dt><dd className="mt-1 font-medium">{confirmation.item_count}</dd></div>
      <div><dt className="text-xs uppercase text-stone-500">Total</dt><dd className="mt-1 text-xl font-semibold">{formatPrice(confirmation.total_sale_price)}</dd></div>
    </dl>
    <div className="mt-6 flex flex-wrap gap-3">
      <button onClick={() => { setConfirmation(null); setMessage(null); }} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">Start new sale</button>
      <Link href={`/sales/${confirmation.sale_id}`} className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium">View sale details</Link>
    </div>
  </section>;

  return <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">Cashier</p><p className="mt-1 font-semibold">{employee.full_name || "Team member"}</p><p className="text-sm capitalize text-stone-500">{employee.role}</p></div>
      <label className="min-w-64 text-sm font-medium">Shop
        <select value={shopId} onChange={(event) => changeShop(event.target.value)} disabled={checkoutShopLocked(employee.role)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 disabled:bg-stone-100">
          {!availableShops.length ? <option value="">No active shop available</option> : null}
          {availableShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
        </select>
      </label>
    </div>

    <form onSubmit={scan} className="mt-6 rounded-xl border-2 border-amber-700 bg-amber-50 p-5">
      <label htmlFor="sales-barcode" className="block text-lg font-semibold">Scan barcode</label>
      <p className="mt-1 text-sm text-stone-600">Scan with a USB scanner or type the exact barcode and press Enter.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input ref={scannerRef} id="sales-barcode" type="search" autoComplete="off" spellCheck={false} placeholder="Scan or type barcode" className="min-w-0 flex-1 rounded-lg border border-amber-800 bg-white px-4 py-3 text-lg font-medium outline-none ring-amber-500 focus:ring-2" />
        <button disabled={isPending || isLookingUp} className="rounded-lg bg-amber-800 px-6 py-3 font-medium text-white disabled:opacity-50">{isLookingUp ? "Looking up…" : "Add item"}</button>
      </div>
      {message ? <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-3 font-medium text-stone-900">{message}</p> : null}
    </form>

    <div className="mt-6 overflow-hidden rounded-xl border border-stone-200">
      <div className="flex items-center justify-between bg-stone-50 px-4 py-3"><h2 className="font-semibold">Current sale</h2><span className="text-sm text-stone-500">{cart.length} item{cart.length === 1 ? "" : "s"}</span></div>
      {cart.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">Scan an in-stock item to begin.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-y border-stone-200 bg-stone-50 text-xs uppercase text-stone-500"><tr>{["Item", "Details", "Weight", "Status", "List price", "Discount %", "Final sale price", ""].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">{cart.map((item) => {
          const priceError = parseSalePrice(item.finalPrice).error;
          const discountError=parseDiscountPercent(item.discountPercent).error;
          return <tr key={item.id}>
            <td className="px-4 py-3"><p className="font-semibold">{item.barcode}</p><p className="text-xs text-stone-500">{item.article_number || "No article"}</p></td>
            <td className="px-4 py-3"><p>{item.category || "Uncategorized"}</p><p className="text-xs text-stone-500">{[item.gold_fineness, item.gold_color, item.size && `Size ${item.size}`].filter(Boolean).join(" · ") || "—"}</p></td>
            <td className="px-4 py-3">{item.weight_grams === null ? "—" : `${item.weight_grams} g`}</td>
            <td className="px-4 py-3"><InventoryStatus status={item.status} /></td>
            <td className="px-4 py-3 whitespace-nowrap">{formatPrice(item.listPrice)}<span className="block text-xs text-stone-500">{effectivePriceSourceLabel(item.source)}</span></td>
            <td className="px-4 py-3"><input aria-label={`Discount for ${item.barcode}`} inputMode="decimal" value={item.discountPercent} onChange={(event)=>setCart(updateCartDiscount(cart,item.id,event.target.value))} className={`w-24 rounded-lg border px-3 py-2 ${discountError?"border-red-500":"border-stone-300"}`} />{discountError?<p className="mt-1 text-xs text-red-700">{discountError}</p>:null}</td>
            <td className="px-4 py-3"><input aria-label={`Final price for ${item.barcode}`} inputMode="decimal" value={item.finalPrice} onChange={(event) => setCart(updateCartPrice(cart, item.id, event.target.value))} className={`w-36 rounded-lg border px-3 py-2 ${priceError ? "border-red-500" : "border-stone-300"}`} />{priceError ? <p className="mt-1 max-w-48 text-xs text-red-700">{priceError}</p> : null}</td>
            <td className="px-4 py-3 text-right"><button onClick={() => { setCart(removeCartItem(cart, item.id)); refocusScanner(); }} className="text-sm font-medium text-red-700 hover:underline">Remove</button></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
      <label className="text-sm font-medium">Sale notes <span className="font-normal text-stone-500">(optional)</span>
        <textarea value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        <span className="mt-1 block text-xs text-stone-500">{notes.length}/5000 characters</span>
      </label>
      <div className="min-w-64 rounded-xl bg-stone-950 p-5 text-white"><p className="text-xs uppercase tracking-wide text-stone-400">Current total</p><p className="mt-2 text-2xl font-semibold">{formatPrice(cartTotal(cart))}</p><button onClick={complete} disabled={cart.length === 0 || isPending || !shopId} className="mt-4 w-full rounded-lg bg-amber-500 px-5 py-3 font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Completing sale…" : "Complete Sale"}</button></div>
    </div>
  </section>;
}
