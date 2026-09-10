export type SalesRegisterFilters = { shopId: string | null; category: string | null; page: number };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSalesRegisterFilters(params: Record<string, string | string[] | undefined>): SalesRegisterFilters {
  const requestedPage = Number(one(params.page) || "1");
  return {
    shopId: one(params.shop) || null,
    category: one(params.category) || null,
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function salesRegisterHref(filters: Omit<SalesRegisterFilters,"page">, page: number) {
  const query = new URLSearchParams();
  if (filters.shopId) query.set("shop", filters.shopId);
  if (filters.category) query.set("category", filters.category);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/sales?${suffix}` : "/sales";
}

export function productSummary(products: { category: string; count: number }[]) {
  return products.map((product) => `${product.category} × ${product.count}`).join(", ");
}
