import { NextResponse } from "next/server";
import { canManageInventory, getCurrentEmployee } from "@/lib/inventory/queries";
import { buildImportPreview, parseImportPayload } from "@/lib/inventory/import/server";

export async function POST(request: Request) {
  const employee = await getCurrentEmployee();
  if (!canManageInventory(employee.role)) return NextResponse.json({ error: "You do not have permission to import inventory." }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid import request." }, { status: 400 }); }
  const payload = parseImportPayload(input);
  if (!payload) return NextResponse.json({ error: "Invalid rows, mapping, or target shop." }, { status: 400 });
  try { return NextResponse.json(await buildImportPreview(payload, employee)); }
  catch { return NextResponse.json({ error: "Unable to validate this import." }, { status: 500 }); }
}

