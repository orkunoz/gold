import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/inventory/queries";
import { normalizeSalesBarcode } from "@/lib/sales/checkout";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePrice } from "@/lib/pricing/effective";

export async function GET(request: NextRequest) {
  const employee = await getCurrentEmployee();
  const barcode = normalizeSalesBarcode(request.nextUrl.searchParams.get("barcode") ?? "");
  const shopId = request.nextUrl.searchParams.get("shop_id") ?? "";
  if (!barcode || !shopId) return NextResponse.json({ error: "Barcode and shop are required." }, { status: 400 });
  if (employee.role !== "owner" && employee.shop_id !== shopId) return NextResponse.json({ error: "You cannot sell for this shop." }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_items")
    .select("id, shop_id, barcode, article_number, gold_fineness, gold_color, weight_grams, size, owner_price, selling_price, status, product_categories(name)")
    .eq("barcode", barcode).eq("shop_id", shopId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to look up this barcode." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Barcode not found." }, { status: 404 });
  try {
    const pricing = await getEffectivePrice(supabase, data.id);
    return NextResponse.json({ item: { ...data, category: data.product_categories?.name ?? null, product_categories: undefined, ...pricing } });
  } catch {
    return NextResponse.json({ error: "Unable to calculate this item's customer price." }, { status: 500 });
  }
}
