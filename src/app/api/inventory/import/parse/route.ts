import { getTranslations } from "@/lib/i18n/server";
import { NextResponse } from "next/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { parseInventoryWorkbook } from "@/lib/inventory/import/parser";

export async function POST(request: Request) {
  const { t, locale } = await getTranslations();
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return NextResponse.json({ error: t("import.messages.permission") }, { status: 403 });
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: t("import.messages.readUpload") }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: t("import.messages.chooseFile") }, { status: 400 });
  try {
    return NextResponse.json(await parseInventoryWorkbook(file, String(formData.get("sheet") ?? "") || undefined, locale));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : t("import.messages.parseWorkbook") }, { status: 400 });
  }
}

