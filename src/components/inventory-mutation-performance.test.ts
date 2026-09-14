import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("inventory mutation latency safeguards", () => {
  it("keeps server actions free of blocking path revalidation and uses one client refresh", () => {
    const actions = read("../lib/inventory/actions.ts");
    const table = read("./inventory-bulk-table.tsx");
    expect(actions).not.toContain("revalidatePath");
    expect(table.match(/router\.refresh\(\)/g)).toHaveLength(1);
  });

  it("does not pre-read an item before the protected update", () => {
    const actions = read("../lib/inventory/actions.ts");
    expect(actions).not.toContain('.select("status")');
    expect(actions).toContain('phase("database_write_and_audit"');
    expect(actions).toContain('.update(toInventoryUpdate(');
  });

  it("keeps import invalidation targeted to Inventory", () => {
    const execute = read("../app/api/inventory/import/execute/route.ts");
    expect(execute).toContain('phaseSync("revalidation", () => revalidatePath("/inventory"))');
    expect(execute).not.toContain('revalidatePath("/dashboard")');
  });

  it("logs safe correlated operation phase durations", () => {
    const timing = read("../lib/inventory/mutation-timing.ts");
    for (const field of ["operation", "phase", "duration_ms", "correlation_id"]) expect(timing).toContain(field);
    expect(timing).not.toMatch(/employee|product|barcode|shop_id/);
  });

  it("disables permanent-delete submission while it is pending", () => {
    const confirmation = read("./confirm-action-button.tsx");
    expect(confirmation).toContain("useFormStatus");
    expect(confirmation).toContain("disabled={pending}");
    expect(confirmation).toContain("aria-busy={pending}");
  });
});
