import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/(protected)/layout.tsx", import.meta.url), "utf8");

describe("current employee query", () => {
  it("selects only account, role, and shop scoping fields without joining shops", () => {
    expect(queries).toContain('.select("id, username, full_name, role, shop_id, is_active")');
    expect(queries).not.toContain('is_active, shops(name)');
  });

  it("keeps role and shop scoping and loads the salesperson shop label separately", () => {
    expect(layout).toContain('employee.role === "salesperson" && employee.shop_id');
    expect(layout).toContain("getShopName(employee.shop_id)");
    expect(layout).toContain('roleLabel={employee.role === "owner" ? t("auth.owner") : t("auth.salesperson")}');
    expect(layout).toContain("<AccountMenu");
  });
});
