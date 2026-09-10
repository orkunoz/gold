import type { EffectivePriceSource, EmployeeRole, InventoryStatus, Json, PricingRuleType } from "@/lib/database.types";

export type CheckoutProduct = {
  id: string;
  shop_id: string;
  barcode: string | null;
  article_number: string | null;
  category: string | null;
  gold_fineness: string | null;
  gold_color: string | null;
  weight_grams: number | null;
  size: string | null;
  owner_price: number | null;
  selling_price: number | null;
  effective_price: number | null;
  source: EffectivePriceSource;
  pricing_rule_id: string | null;
  rule_type: PricingRuleType | null;
  rule_value: number | null;
  status: InventoryStatus;
};

export type CartItem = CheckoutProduct & { listPrice: number | null; discountPercent: string };

export function normalizeSalesBarcode(value: string) {
  return value.trim();
}

export function unavailableMessage(status: InventoryStatus) {
  if (status === "SOLD") return "This item is already sold.";
  if (status === "REMOVED") return "This item has been removed from inventory.";
  return null;
}

export function defaultListPrice(product: Pick<CheckoutProduct, "effective_price">) {
  return product.effective_price;
}

export function addProductToCart(cart: CartItem[], product: CheckoutProduct) {
  const unavailable = unavailableMessage(product.status);
  if (unavailable) return { cart, error: unavailable };
  if (cart.some((item) => item.id === product.id)) return { cart, error: "This item is already in the current sale." };
  const listPrice = defaultListPrice(product);
  return { cart: [...cart, { ...product, listPrice, discountPercent: "0" }], error: null };
}

export function parseDiscountPercent(value: string) {
  const normalized=value.trim().replace(",", ".")||"0";
  if(!/^\d+(?:\.\d{1,4})?$/.test(normalized))return {value:null,error:"Enter a discount from 0 to 100."};
  const discount=Number(normalized);
  if(!Number.isFinite(discount)||discount<0||discount>100)return {value:null,error:"Enter a discount from 0 to 100."};
  return {value:discount,error:null};
}

export function discountedPrice(listPrice:number|null,discount:string){
  const parsed=parseDiscountPercent(discount);
  if(listPrice===null||parsed.value===null)return null;
  return Math.round(listPrice*(1-parsed.value/100)*100)/100;
}

export function updateCartDiscount(cart:CartItem[],id:string,discountPercent:string){
  return cart.map(item=>item.id===id?{...item,discountPercent}:item);
}

export function removeCartItem(cart: CartItem[], id: string) {
  return cart.filter((item) => item.id !== id);
}

export function buildSaleRpcItems(cart: CartItem[]): { value: Json | null; error: string | null } {
  if (cart.length === 0) return { value: null, error: "Add at least one item before completing the sale." };
  const items: { inventory_item_id: string; discount_percent: number }[] = [];
  for (const item of cart) {
    const discount=parseDiscountPercent(item.discountPercent);
    if(discount.error||discount.value===null)return {value:null,error:`Check the discount for ${item.barcode??item.article_number??"this item"}.`};
    if (item.listPrice === null) return { value: null, error: `A list price is required for ${item.barcode??item.article_number??"this item"}.` };
    items.push({ inventory_item_id: item.id, discount_percent: discount.value });
  }
  return { value: items, error: null };
}

export function cartTotal(cart: CartItem[]) {
  return cart.reduce((total, item) => total + (discountedPrice(item.listPrice, item.discountPercent) ?? 0), 0);
}

export function checkoutShopLocked(role: EmployeeRole) {
  return role !== "owner";
}

export function checkoutShops(role: EmployeeRole, employeeShopId: string | null, shops: { id: string; name: string }[]) {
  return role === "owner" ? shops : shops.filter((shop) => shop.id === employeeShopId);
}

export function cartAfterCompletion<T>(cart: T[], succeeded: boolean) {
  return succeeded ? [] : cart;
}
