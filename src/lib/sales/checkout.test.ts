import { describe, expect, it } from "vitest";
import { addProductToCart, buildSaleRpcItems, cartAfterCompletion, checkoutShopLocked, checkoutShops, defaultListPrice, normalizeSalesBarcode, parseSalePrice, removeCartItem, updateCartPrice, type CheckoutProduct } from "./checkout";

const product = (overrides: Partial<CheckoutProduct> = {}): CheckoutProduct => ({ id: "item-1", shop_id: "shop-1", barcode: "ABC-1", article_number: "ART", category: "Ring", gold_fineness: "585", gold_color: "Yellow", weight_grams: 2.5, size: "17", owner_price: 100, selling_price: 120, status: "IN_STOCK", ...overrides });

describe("sales checkout", () => {
  it("trims scans and adds an exact IN_STOCK product with the customer price", () => {
    expect(normalizeSalesBarcode("  AbC-1\n")).toBe("AbC-1");
    expect(addProductToCart([], product())).toMatchObject({ error: null, cart: [{ id: "item-1", listPrice: 120, finalPrice: "120" }] });
  });

  it.each([
    ["SOLD", "already sold"], ["RESERVED", "reserved"], ["REMOVED", "removed"],
  ] as const)("rejects %s products", (status, message) => {
    expect(addProductToCart([], product({ status })).error).toContain(message);
  });

  it("rejects a duplicate physical item in the current cart", () => {
    const first = addProductToCart([], product()).cart;
    expect(addProductToCart(first, product())).toMatchObject({ cart: first, error: expect.stringContaining("already in") });
  });

  it("falls back to owner price and allows a missing price to be entered", () => {
    expect(defaultListPrice(product({ selling_price: null }))).toBe(100);
    expect(addProductToCart([], product({ selling_price: null, owner_price: null })).cart[0].finalPrice).toBe("");
  });

  it("edits and removes cart items without database state", () => {
    const cart = addProductToCart([], product()).cart;
    expect(updateCartPrice(cart, "item-1", "99.50")[0].finalPrice).toBe("99.50");
    expect(removeCartItem(cart, "item-1")).toEqual([]);
  });

  it("validates non-negative prices with at most two decimals", () => {
    expect(parseSalePrice("3  ")).toEqual({ value: 3, error: null });
    expect(parseSalePrice("12,50")).toEqual({ value: 12.5, error: null });
    expect(parseSalePrice("-1").error).toBeTruthy();
    expect(parseSalePrice("1.234").error).toBeTruthy();
    expect(parseSalePrice("").error).toBeTruthy();
  });

  it("builds an RPC payload containing only item id and final price", () => {
    const cart = updateCartPrice(addProductToCart([], product()).cart, "item-1", "99.50");
    expect(buildSaleRpcItems(cart)).toEqual({ value: [{ inventory_item_id: "item-1", sale_price: 99.5 }], error: null });
    expect(buildSaleRpcItems([]).error).toContain("at least one");
  });

  it("clears the cart only after successful completion", () => {
    const cart = addProductToCart([], product()).cart;
    expect(cartAfterCompletion(cart, true)).toEqual([]);
    expect(cartAfterCompletion(cart, false)).toBe(cart);
  });

  it("allows only owners to select among shops", () => {
    const shops = [{ id: "shop-1", name: "One" }, { id: "shop-2", name: "Two" }];
    expect(checkoutShopLocked("owner")).toBe(false);
    expect(checkoutShops("owner", "shop-1", shops)).toHaveLength(2);
    expect(checkoutShopLocked("manager")).toBe(true);
    expect(checkoutShops("manager", "shop-1", shops)).toEqual([shops[0]]);
    expect(checkoutShopLocked("salesperson")).toBe(true);
  });
});
