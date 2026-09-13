import { getTranslations } from "@/lib/i18n/server";
import { NextResponse } from "next/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { buildImportPreview, parseImportPayload } from "@/lib/inventory/import/server";

export async function POST(request: Request) {
  const { t } = await getTranslations();
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return NextResponse.json({ error: t("import.messages.permission") }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: t("import.messages.invalidRequest") }, { status: 400 }); }
  const payload = parseImportPayload(input);
  if (!payload) return NextResponse.json({ error: t("import.messages.invalidPayload") }, { status: 400 });
  try { return NextResponse.json(await buildImportPreview(payload)); }
  catch { return NextResponse.json({ error: t("import.messages.validateImport") }, { status: 500 }); }
}
