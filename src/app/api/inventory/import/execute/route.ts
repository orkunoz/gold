import { getTranslations } from "@/lib/i18n/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { buildImportPreview, parseImportPayload } from "@/lib/inventory/import/server";
import { toInsert } from "@/lib/inventory/import/validation";
import { batchImportRows } from "@/lib/inventory/import/batch";
import { inventoryMutationTimer } from "@/lib/inventory/mutation-timing";

export async function POST(request: Request) {
  const timing = inventoryMutationTimer("import_execute");
  const [{ t }, employee] = await timing.phase("authorization_and_locale", () => Promise.all([getTranslations(), getCurrentEmployee()]));
  if (!canManageInventory(employee.role)) { timing.finish(); return NextResponse.json({ error: t("import.messages.permission") }, { status: 403 }); }
  let input: unknown;
  try { input = await request.json(); } catch { timing.finish(); return NextResponse.json({ error: t("import.messages.invalidRequest") }, { status: 400 }); }
  const payload = parseImportPayload(input);
  if (!payload) { timing.finish(); return NextResponse.json({ error: t("import.messages.invalidPayload") }, { status: 400 }); }

  try {
    const preview = await timing.phase("validation_and_duplicate_reads", () => buildImportPreview(payload));
    const valid = preview.rows.filter((row) => row.classification !== "Error" && row.item);
    const failures: { row: number; message: string }[] = [];
    let imported = 0;
    const supabase = await createClient();
    for (const batch of batchImportRows(valid)) {
      const inserts = batch.map((row) => toInsert(row.item!, employee.id));
      const { error } = await timing.phase("database_rpc_and_audit", () => supabase.rpc("import_inventory_items",{p_items:inserts}));
      if (!error) { imported += batch.length; continue; }
      for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
        const { error: rowError } = await timing.phase("database_retry_rpc_and_audit", () => supabase.rpc("import_inventory_items",{p_items:[inserts[itemIndex]]}));
        if (rowError) failures.push({ row: batch[itemIndex].sourceRow, message: rowError.code === "23505" ? t("import.messages.barcodeExists") : t("import.messages.databaseRejected") });
        else imported += 1;
      }
    }
    timing.phaseSync("revalidation", () => revalidatePath("/inventory"));
    timing.finish();
    return NextResponse.json({ imported, skipped: preview.summary.errors, footerSkipped: preview.summary.footerSkipped, duplicates: preview.summary.duplicates, failed: failures.length, failures });
  } catch {
    timing.finish();
    return NextResponse.json({ error: t("import.messages.notCompleted") }, { status: 500 });
  }
}
