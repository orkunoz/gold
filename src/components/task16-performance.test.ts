import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("protected navigation performance guards", () => {
  it("does not query every active shop from the shared layout", () => {
    expect(read("../app/(protected)/layout.tsx")).not.toContain("getActiveShops");
  });

  it("only loads Sales shop options for owners", () => {
    const source = read("../app/(protected)/sales/page.tsx");
    expect(source).toContain('employee.role === "owner" ? await getActiveShops() : []');
  });

  it("keeps internal navigation on Next Link with pending feedback", () => {
    const source = read("./navigation.tsx");
    expect(source).toContain("useLinkStatus");
    expect(source).not.toContain("window.location");
  });

  it("keeps administration reads split by screen", () => {
    expect(read("../app/(protected)/admin/employees/page.tsx")).toContain("getAdminEmployees");
    expect(read("../app/(protected)/admin/shops/page.tsx")).toContain("getAdminShops");
  });
});
