"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeRole } from "@/lib/database.types";
import { completeSaleAction, type SaleConfirmation } from "@/lib/sales/actions";
import { addProductToCart, buildSaleRpcItems, cartTotal, checkoutShops, discountedPrice, normalizeSalesBarcode, parseDiscountPercent, removeCartItem, updateCartDiscount, type CartItem, type CheckoutProduct } from "@/lib/sales/checkout";
import { formatPrice } from "@/lib/inventory/format";
import { InventoryStatus } from "@/components/inventory-status";
import { useI18n } from "./i18n-provider";
import { locationDisplayName } from "@/lib/locations/display";
import { CameraBarcodeScanner } from "./camera-barcode-scanner";
import { Button, buttonStyles } from "./ui/button";

type Shop = { id: string; name: string; location_type?: string | null };

export function SalesCheckout({ employee, shops }: { employee: { username?:string|null; full_name: string | null; role: EmployeeRole; shop_id: string | null; shops?: { name: string } | null }; shops: Shop[] }) {
  const { t, locale } = useI18n();
  const availableShops = checkoutShops(employee.role, employee.shop_id, shops);
  const [shopId, setShopId] = useState(employee.role === "owner" ? availableShops[0]?.id ?? "" : employee.shop_id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [confirmation, setConfirmation] = useState<SaleConfirmation | null>(null);
  const [matches,setMatches]=useState<CheckoutProduct[]>([]);
  const [articleQuery,setArticleQuery]=useState("");
  const [articlePage,setArticlePage]=useState(1);
  const [articleTotal,setArticleTotal]=useState(0);
  const [hasMoreMatches,setHasMoreMatches]=useState(false);
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

  async function scan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const barcode = normalizeSalesBarcode(scannerRef.current?.value ?? "");
    if (!barcode) { refocusScanner(); return; }
    if (isLookingUp || isPending) return;
    if (!shopId) { setMessage(t("sales.selectShop")); refocusScanner(true); return; }
    setMessage(t("sales.lookup"));
    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/sales/lookup?code=${encodeURIComponent(barcode)}&shop_id=${encodeURIComponent(shopId)}`);
      const payload = await response.json() as { item?: CheckoutProduct; items?:CheckoutProduct[]; error?: string; articlePage?:number; totalArticleMatches?:number; hasMore?:boolean };
      if (!response.ok || (!payload.item&&!payload.items?.length)) {
        setMessage(response.status === 404 ? t("sales.notFound") : payload.error ?? t("sales.lookupFailed"));
        refocusScanner(true);
        return;
      }
      if(payload.items){setMatches(payload.items);setArticleQuery(barcode);setArticlePage(payload.articlePage??1);setArticleTotal(payload.totalArticleMatches??payload.items.length);setHasMoreMatches(Boolean(payload.hasMore));setMessage(t("sales.physicalMatches",{count:payload.totalArticleMatches??payload.items.length}));refocusScanner();return;}
      const foundItem=payload.item!;
      const result = addProductToCart(cart, foundItem, locale);
      setCart(result.cart);
      setMatches([]);setMessage(result.error);
      if (scannerRef.current) scannerRef.current.value = "";
      refocusScanner(result.error !== null);
    } catch {
      setMessage(t("sales.connectionFailed"));
      refocusScanner(true);
    } finally {
      setIsLookingUp(false);
    }
  }

  async function loadMoreArticleMatches(){
    if(!articleQuery||!hasMoreMatches||isLookingUp)return;
    setIsLookingUp(true);
    try{
      const nextPage=articlePage+1;
      const response=await fetch(`/api/sales/lookup?code=${encodeURIComponent(articleQuery)}&shop_id=${encodeURIComponent(shopId)}&article_page=${nextPage}`);
      const payload=await response.json() as {items?:CheckoutProduct[];error?:string;articlePage?:number;totalArticleMatches?:number;hasMore?:boolean};
      if(!response.ok||!payload.items){setMessage(payload.error??t("sales.loadMoreFailed"));return;}
      setMatches(current=>[...current,...payload.items!]);setArticlePage(payload.articlePage??nextPage);setArticleTotal(payload.totalArticleMatches??articleTotal);setHasMoreMatches(Boolean(payload.hasMore));
    }catch{setMessage(t("sales.loadMoreFailed"));}finally{setIsLookingUp(false);}
  }

  function changeShop(nextShopId: string) {
    setShopId(nextShopId);
    setCart([]);
    setConfirmation(null);
    setMatches([]);setArticleQuery("");setArticlePage(1);setArticleTotal(0);setHasMoreMatches(false);
    setMessage(cart.length ? t("sales.shopChanged") : null);
    refocusScanner();
  }

  function complete() {
    const rpcItems = buildSaleRpcItems(cart,locale);
    if (rpcItems.error || !rpcItems.value) { setMessage(rpcItems.error); return; }
    setMessage(null);
    startTransition(async () => {
      const result = await completeSaleAction({ shopId, items: rpcItems.value! });
      if (!result.success) { setMessage(result.error); refocusScanner(); return; }
      setCart([]);
      setConfirmation(result.sale);
      router.refresh();
    });
  }

  if (confirmation) return <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">{t("sales.completed")}</p>
    <h2 className="mt-3 text-2xl font-semibold">{confirmation.sale_number}</h2>
    <dl className="mt-5 grid gap-4 sm:grid-cols-3">
      <div><dt className="text-xs uppercase text-stone-500">{t("common.date")}</dt><dd className="mt-1 font-medium">{new Date(confirmation.sold_at).toLocaleString(locale === "ua" ? "uk-UA" : "en-UA",{timeZone:"Europe/Kyiv"})}</dd></div>
      <div><dt className="text-xs uppercase text-stone-500">{t("sales.items")}</dt><dd className="mt-1 font-medium">{confirmation.item_count}</dd></div>
      <div><dt className="text-xs uppercase text-stone-500">{t("common.total")}</dt><dd className="mt-1 text-xl font-semibold">{formatPrice(confirmation.total_sale_price,locale)}</dd></div>
    </dl>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button onClick={() => { setConfirmation(null); setMessage(null); }}>{t("sales.startNew")}</Button>
      <Link href={`/sales/${confirmation.sale_id}`} className={buttonStyles("secondary")}>{t("sales.viewDetails")}</Link>
    </div>
  </section>;

  return <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      {employee.role === "owner" ? <label className="min-w-64 text-sm font-medium">{t("fields.shop")}
        <select value={shopId} onChange={(event) => changeShop(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
          {!availableShops.length ? <option value="">{t("sales.noShop")}</option> : null}
          {availableShops.map((shop) => <option key={shop.id} value={shop.id}>{locationDisplayName(shop,locale)}</option>)}
        </select>
      </label> : null}
    </div>

    <form onSubmit={scan} className="mt-6 rounded-xl border-2 border-amber-700 bg-amber-50 p-5">
      <label htmlFor="sales-barcode" className="block text-lg font-semibold">{t("sales.scanLabel")}</label>
      <p className="mt-1 text-sm text-stone-600">{t("sales.scanHint")}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input ref={scannerRef} id="sales-barcode" type="search" autoComplete="off" spellCheck={false} placeholder={t("sales.scanPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-amber-800 bg-white px-4 py-3 text-lg font-medium outline-none ring-amber-500 focus:ring-2" />
        <CameraBarcodeScanner returnFocus={scannerRef} onDetected={value=>{if(scannerRef.current)scannerRef.current.value=value;void scan()}}/>
        <button disabled={isPending || isLookingUp} className="rounded-lg bg-amber-800 px-6 py-3 font-medium text-white disabled:opacity-50">{isLookingUp ? t("sales.lookingUp") : t("sales.addItem")}</button>
      </div>
      {message ? <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-3 font-medium text-stone-900">{message}</p> : null}
    </form>
    {matches.length?<div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t("sales.chooseItem")}</h2><span className="text-sm text-stone-600">{t("sales.showing",{shown:matches.length,total:articleTotal})}</span></div><div className="mt-3 grid gap-3">{matches.map(item=><div key={item.id} className="flex flex-col gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.category??t("sales.uncategorized")} · {t("fields.article")} {item.article_number??"—"}</p><p className="text-sm text-stone-500">{t("fields.barcode")} {item.barcode??t("sales.noBarcode")} · {item.weight_grams??"—"} {t("common.grams")} · {t(`status.${item.status}`)}</p></div><button type="button" onClick={()=>{const result=addProductToCart(cart,item,locale);setCart(result.cart);setMessage(result.error);setMatches([]);setHasMoreMatches(false);refocusScanner();}} className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white sm:w-auto">{t("sales.add")}</button></div>)}</div>{hasMoreMatches?<button type="button" disabled={isLookingUp} onClick={()=>void loadMoreArticleMatches()} className="mt-4 w-full rounded-lg border border-amber-800 bg-white px-4 py-2 text-sm font-medium text-amber-950 disabled:opacity-50">{isLookingUp?t("common.loading"):t("sales.loadMore")}</button>:null}</div>:null}

    <div className="zl-table-wrap mt-6">
      <div className="flex items-center justify-between bg-stone-50 px-4 py-3"><h2 className="font-semibold">{t("sales.current")}</h2><span className="text-sm text-stone-500">{t("sales.itemCount",{count:cart.length})}</span></div>
      {cart.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">{t("sales.empty")}</p> : <div className="overflow-x-auto"><table className="zl-table zl-table--dense min-w-[920px]">
        <thead><tr>{["productDetails", "weight", "status", "discount", "salePrice"].map((key) => <th key={key} className={["weight","discount","salePrice"].includes(key)?"zl-table-number":""}>{t(`fields.${key}`)}</th>)}<th /></tr></thead>
        <tbody>{cart.map((item) => {
          const discountError=parseDiscountPercent(item.discountPercent,locale).error;
          return <tr key={item.id}>
            <td><p className="font-semibold">{item.barcode??t("sales.noBarcode")}</p><p className="text-xs text-stone-500">{item.article_number || t("sales.noArticle")} · {item.category || t("sales.uncategorized")}</p><p className="text-xs text-stone-500">{[item.gold_color, item.size && `${t("fields.size")} ${item.size}`].filter(Boolean).join(" · ") || "—"}</p></td>
            <td className="zl-table-number">{item.weight_grams === null ? "—" : `${item.weight_grams} ${t("common.grams")}`}</td>
            <td><InventoryStatus status={item.status} /></td>
            <td className="zl-table-number"><input aria-label={t("sales.discountFor",{name:item.barcode??item.article_number??t("sales.product")})} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={item.discountPercent} onChange={(event)=>setCart(updateCartDiscount(cart,item.id,event.target.value))} className={`zl-control w-24 px-3 text-right ${discountError?"border-red-500":"border-stone-300"}`} />{discountError?<p className="mt-1 text-xs text-red-700">{discountError}</p>:null}</td>
            <td className="zl-table-number whitespace-nowrap font-semibold">{formatPrice(discountedPrice(item.listPrice, item.discountPercent),locale)}</td>
            <td className="text-right"><button onClick={() => { setCart(removeCartItem(cart, item.id)); refocusScanner(); }} className="text-sm font-medium text-red-700 hover:underline">{t("sales.remove")}</button></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </div>

    <div className="mt-6 flex justify-end">
      <div className="w-full min-w-64 rounded-xl bg-stone-950 p-5 text-white sm:w-auto"><p className="text-xs uppercase tracking-wide text-stone-400">{t("sales.currentTotal")}</p><p className="mt-2 text-2xl font-semibold">{formatPrice(cartTotal(cart),locale)}</p><button onClick={complete} disabled={cart.length === 0 || isPending || !shopId} className="mt-4 w-full rounded-lg bg-amber-500 px-5 py-3 font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? t("sales.completing") : t("sales.complete")}</button></div>
    </div>
  </section>;
}
