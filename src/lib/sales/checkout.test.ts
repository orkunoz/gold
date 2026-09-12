import { describe, expect, it } from "vitest";
import { addProductToCart, articleMatchPage, articleMatchRange, buildSaleRpcItems, cartAfterCompletion, cartTotal, checkoutShopLocked, checkoutShops, defaultListPrice, discountedPrice, normalizeSalesBarcode, parseDiscountPercent, removeCartItem, updateCartDiscount, type CheckoutProduct } from "./checkout";

const product = (overrides: Partial<CheckoutProduct> = {}): CheckoutProduct => ({ id: "item-1", shop_id: "shop-1", barcode: "ABC-1", article_number: "ART", category: "Ring", gold_fineness: "585", gold_color: "Yellow", weight_grams: 2.5, size: "17", owner_price: 100, selling_price: 120, effective_price: 120, source: "MANUAL", pricing_rule_id: null, rule_type: null, rule_value: null, status: "IN_STOCK", ...overrides });

describe("sales checkout", () => {
  it("trims scans and adds an exact IN_STOCK product with the customer price", () => {
    expect(normalizeSalesBarcode("  AbC-1\n")).toBe("AbC-1");
    expect(addProductToCart([], product())).toMatchObject({ error: null, cart: [{ id: "item-1", listPrice: 120, discountPercent:"0" }] });
  });

  it("supports an article-only item without a barcode",()=>expect(addProductToCart([],product({barcode:null,article_number:"ARTICLE-7"}))).toMatchObject({error:null,cart:[{article_number:"ARTICLE-7",barcode:null}]}));

  it("keeps repeated-article lookup bounded and paginated",()=>{expect(articleMatchPage(null)).toBe(1);expect(articleMatchPage("bad")).toBe(1);expect(articleMatchPage("2")).toBe(2);expect(articleMatchRange(2)).toEqual({from:50,to:99});});

  it.each([
    ["SOLD", "already sold"], ["REMOVED", "removed"],
  ] as const)("rejects %s products", (status, message) => {
    expect(addProductToCart([], product({ status })).error).toContain(message);
  });

  it("rejects a duplicate physical item in the current cart", () => {
    const first = addProductToCart([], product()).cart;
    expect(addProductToCart(first, product())).toMatchObject({ cart: first, error: expect.stringContaining("already in") });
  });

  it("uses the server-resolved effective price and rejects checkout when it is missing", () => {
    expect(addProductToCart([], product({ selling_price: null, effective_price: 15000, source: "INVENTORY_FORMULA" }))).toMatchObject({
      cart: [{ listPrice: 15000, source: "INVENTORY_FORMULA" }],
    });
    expect(defaultListPrice(product({ selling_price: null, effective_price: 115, source: "PRICING_RULE" }))).toBe(115);
    const missing = addProductToCart([], product({ selling_price: null, owner_price: null, effective_price: null, source: "OWNER_PRICE_FALLBACK" })).cart;
    expect(missing[0].listPrice).toBeNull();
    expect(buildSaleRpcItems(missing).error).toContain("price");
  });

  it("removes cart items without database state", () => {
    const cart = addProductToCart([], product()).cart;
    expect(removeCartItem(cart, "item-1")).toEqual([]);
  });

  it("builds an RPC payload containing only item id and discount", () => {
    const cart = addProductToCart([], product()).cart;
    expect(buildSaleRpcItems(cart)).toEqual({ value: [{ inventory_item_id: "item-1", discount_percent:0 }], error: null });
    expect(buildSaleRpcItems([]).error).toContain("at least one");
  });

  it("validates and applies per-item discounts",()=>{
    expect(parseDiscountPercent("12.5")).toEqual({value:12.5,error:null});
    expect(parseDiscountPercent("-1").error).toBeTruthy(); expect(parseDiscountPercent("101").error).toBeTruthy();
    expect(discountedPrice(200,"10")).toBe(180); expect(discountedPrice(200,"12.5")).toBe(175); expect(discountedPrice(200,"100")).toBe(0);
    const cart=addProductToCart([],product({effective_price:200})).cart;
    expect(updateCartDiscount(cart,"item-1","10")[0].discountPercent).toBe("10");
    expect(cartTotal(updateCartDiscount(cart,"item-1","10"))).toBe(180);
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
    expect(checkoutShopLocked("salesperson")).toBe(true);
    expect(checkoutShops("salesperson", "shop-1", shops)).toEqual([shops[0]]);
  });
});
