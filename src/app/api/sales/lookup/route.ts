import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { ARTICLE_MATCH_PAGE_SIZE, articleMatchPage, articleMatchRange, normalizeSalesBarcode } from "@/lib/sales/checkout";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePrice, getEffectivePrices } from "@/lib/pricing/effective";

export async function GET(request: NextRequest) {
  const employee = await getCurrentEmployee();
  const code = normalizeSalesBarcode(request.nextUrl.searchParams.get("code") ?? request.nextUrl.searchParams.get("barcode") ?? "");
  const shopId = request.nextUrl.searchParams.get("shop_id") ?? "";
  const articlePage = articleMatchPage(request.nextUrl.searchParams.get("article_page"));
  if (!code || !shopId) return NextResponse.json({ error: "Barcode or article and shop are required." }, { status: 400 });
  if (employee.role !== "owner" && employee.shop_id !== shopId) return NextResponse.json({ error: "You cannot sell for this shop." }, { status: 403 });

  const supabase = await createClient();
  const selection="id, shop_id, barcode, article_number, gold_fineness, gold_color, weight_grams, size, owner_price, selling_price, status, product_categories(name)" as const;
  const { data, error } = await supabase.from("inventory_items").select(selection).eq("barcode", code).eq("shop_id", shopId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to look up this item." }, { status: 500 });
  try {
    if(data){const pricing=await getEffectivePrice(supabase,data.id);return NextResponse.json({item:{...data,category:data.product_categories?.name??null,product_categories:undefined,...pricing},matchedBy:"barcode"});}
    const {from,to}=articleMatchRange(articlePage);
    const {data:articleItems,error:articleError,count}=await supabase.from("inventory_items").select(selection,{count:"exact"}).eq("article_number",code).eq("shop_id",shopId).order("created_at").range(from,to);
    if(articleError)return NextResponse.json({error:"Unable to look up this item."},{status:500});
    if(!articleItems?.length)return NextResponse.json({error:"Barcode or article not found."},{status:404});
    const prices=await getEffectivePrices(supabase,articleItems.map(item=>item.id));
    const items=articleItems.map(item=>({...item,category:item.product_categories?.name??null,product_categories:undefined,...prices.get(item.id)}));
    if(items.length===1&&(count??1)===1)return NextResponse.json({item:items[0],matchedBy:"article"});
    return NextResponse.json({items,matchedBy:"article",articlePage,articlePageSize:ARTICLE_MATCH_PAGE_SIZE,totalArticleMatches:count??items.length,hasMore:from+items.length<(count??items.length)});
  } catch {
    return NextResponse.json({ error: "Unable to calculate this item's customer price." }, { status: 500 });
  }
}
