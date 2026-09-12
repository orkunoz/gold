import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Task 19 SOLD product immutability", () => {
  it("keeps SOLD product details visible without edit or delete controls", () => {
    const detail = read("../app/(protected)/inventory/[id]/page.tsx");
    expect(detail).toContain('item.status!=="SOLD"');
    expect(detail).toContain('t("inventory.readOnly")');
  });

  it("redirects direct SOLD edit routes back to Product Detail", () => {
    expect(read("../app/(protected)/inventory/[id]/edit/page.tsx"))
      .toContain('item.status === "SOLD"');
  });

  it("omits the Status control when adding a product and defaults it to IN_STOCK", () => {
    const form = read("./inventory-form.tsx");
    const actions = read("../lib/inventory/actions.ts");
    expect(form).toContain('item?<label className={label}>{t("fields.status")}');
    expect(form).toContain('<input type="hidden" name="status" value="IN_STOCK"/>');
    expect(actions).toContain('formData.set("status", "IN_STOCK")');
  });
});
