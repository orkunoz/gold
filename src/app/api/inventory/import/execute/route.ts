import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { buildImportPreview, parseImportPayload } from "@/lib/inventory/import/server";
import { toInsert } from "@/lib/inventory/import/validation";
import { batchImportRows } from "@/lib/inventory/import/batch";

export async function POST(request: Request) {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return NextResponse.json({ error: "You do not have permission to import inventory." }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid import request." }, { status: 400 }); }
  const payload = parseImportPayload(input);
  if (!payload) return NextResponse.json({ error: "Invalid rows, mapping, or target shop." }, { status: 400 });

  try {
    const preview = await buildImportPreview(payload);
    const valid = preview.rows.filter((row) => row.classification !== "Error" && row.item);
    const failures: { row: number; message: string }[] = [];
    let imported = 0;
    const supabase = await createClient();
    for (const batch of batchImportRows(valid)) {
      const inserts = batch.map((row) => toInsert(row.item!, employee.id));
      const { error } = await supabase.rpc("import_inventory_items",{p_items:inserts});
      if (!error) { imported += batch.length; continue; }
      for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
        const { error: rowError } = await supabase.rpc("import_inventory_items",{p_items:[inserts[itemIndex]]});
        if (rowError) failures.push({ row: batch[itemIndex].sourceRow, message: rowError.code === "23505" ? "Barcode already exists" : "Database rejected this row" });
        else imported += 1;
      }
    }
    revalidatePath("/inventory");
    return NextResponse.json({ imported, skipped: preview.summary.errors, footerSkipped: preview.summary.footerSkipped, duplicates: preview.summary.duplicates, failed: failures.length, failures });
  } catch {
    return NextResponse.json({ error: "The import could not be completed." }, { status: 500 });
  }
}
