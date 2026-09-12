import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("localized operational UI", () => {
  it("offers language selection on login and authenticated pages", () => {
    expect(read("src/app/login/page.tsx")).toContain("<LanguageSelector />");
    expect(read("src/app/(protected)/layout.tsx")).toContain("<LanguageSelector />");
    expect(read("src/app/api/language/route.ts")).toContain("maxAge: 60 * 60 * 24 * 365");
  });

  it("localizes Owner and Salesperson navigation from translation keys", () => {
    const source = read("src/components/navigation.tsx");
    expect(source).toContain('key: "nav.dashboard"');
    expect(source).toContain('key: "nav.administration"');
    expect(source).toContain('role === "owner"');
  });

  it("localizes login, inventory, checkout, and dashboard surfaces", () => {
    expect(read("src/components/login-form.tsx")).toContain('t("auth.username")');
    expect(read("src/components/inventory-form.tsx")).toContain('t("fields.productCategory")');
    expect(read("src/components/sales-checkout.tsx")).toContain('t("sales.complete")');
    expect(read("src/app/(protected)/dashboard/page.tsx")).toContain('t("dashboard.revenue")');
  });
});
