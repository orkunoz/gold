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

export function salesPresetRange(period:string,now=new Date()){
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Kyiv",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const day=new Date(`${date}T00:00:00Z`); let from:string|null=null; let to:string|null=null;
 const iso=(value:Date)=>value.toISOString().slice(0,10);
 if(period==="today"){from=date;to=iso(new Date(day.getTime()+86400000));}
 if(period==="yesterday"){from=iso(new Date(day.getTime()-86400000));to=date;}
 if(period==="last7"){from=iso(new Date(day.getTime()-6*86400000));to=iso(new Date(day.getTime()+86400000));}
 if(period==="month"){from=`${date.slice(0,8)}01`;to=iso(new Date(day.getTime()+86400000));}
 return{from,to};
}
