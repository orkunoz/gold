import { NextResponse } from "next/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { parseInventoryWorkbook } from "@/lib/inventory/import/parser";

export async function POST(request: Request) {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return NextResponse.json({ error: "You do not have permission to import inventory." }, { status: 403 });
  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "Unable to read the upload." }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an .xlsx file." }, { status: 400 });
  try {
    return NextResponse.json(await parseInventoryWorkbook(file, String(formData.get("sheet") ?? "") || undefined));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to parse workbook." }, { status: 400 });
  }
}

