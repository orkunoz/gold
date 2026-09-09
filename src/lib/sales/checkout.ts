import type { EmployeeRole, InventoryStatus, Json } from "@/lib/database.types";

export type CheckoutProduct = {
  id: string;
  shop_id: string;
  barcode: string;
  article_number: string | null;
  category: string | null;
  gold_fineness: string | null;
  gold_color: string | null;
  weight_grams: number | null;
  size: string | null;
  owner_price: number | null;
  selling_price: number | null;
  status: InventoryStatus;
};

export type CartItem = CheckoutProduct & { listPrice: number | null; finalPrice: string };

export function normalizeSalesBarcode(value: string) {
  return value.trim();
}

export function unavailableMessage(status: InventoryStatus) {
  if (status === "SOLD") return "This item is already sold.";
  if (status === "RESERVED") return "This item is reserved and cannot be sold.";
  if (status === "REMOVED") return "This item has been removed from inventory.";
  return null;
}

export function defaultListPrice(product: Pick<CheckoutProduct, "selling_price" | "owner_price">) {
  return product.selling_price ?? product.owner_price;
}

export function addProductToCart(cart: CartItem[], product: CheckoutProduct) {
  const unavailable = unavailableMessage(product.status);
  if (unavailable) return { cart, error: unavailable };
  if (cart.some((item) => item.id === product.id)) return { cart, error: "This item is already in the current sale." };
  const listPrice = defaultListPrice(product);
  return { cart: [...cart, { ...product, listPrice, finalPrice: listPrice === null ? "" : String(listPrice) }], error: null };
}

export function parseSalePrice(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { value: null, error: "Enter a non-negative price with no more than 2 decimal places." };
  const price = Number(normalized);
  if (!Number.isFinite(price) || price > 999999999999.99) return { value: null, error: "Enter a price within the supported range." };
  return { value: price, error: null };
}

export function updateCartPrice(cart: CartItem[], id: string, finalPrice: string) {
  return cart.map((item) => item.id === id ? { ...item, finalPrice } : item);
}

export function removeCartItem(cart: CartItem[], id: string) {
  return cart.filter((item) => item.id !== id);
}

export function buildSaleRpcItems(cart: CartItem[]): { value: Json | null; error: string | null } {
  if (cart.length === 0) return { value: null, error: "Add at least one item before completing the sale." };
  const items: { inventory_item_id: string; sale_price: number }[] = [];
  for (const item of cart) {
    const price = parseSalePrice(item.finalPrice);
    if (price.error || price.value === null) return { value: null, error: `Check the final price for ${item.barcode}.` };
    items.push({ inventory_item_id: item.id, sale_price: price.value });
  }
  return { value: items, error: null };
}

export function cartTotal(cart: CartItem[]) {
  return cart.reduce((total, item) => total + (parseSalePrice(item.finalPrice).value ?? 0), 0);
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
