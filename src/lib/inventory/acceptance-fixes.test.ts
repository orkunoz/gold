import { describe, expect, it } from "vitest";
import { createTranslator } from "@/lib/i18n/core";
import { bulkInventoryError } from "./bulk-errors";
import { historyActorName } from "./history-actor";
import { readFileSync } from "node:fs";

describe("inventory acceptance fixes", () => {
  it("maps every known ineligible bulk business error to one localized key", () => {
    const error = { code: "22023", message: "Selection contains an ineligible or SOLD product." };
    expect(bulkInventoryError(error, createTranslator("en"), "inventory.moveFailed")).toBe("Selection contains an ineligible or SOLD product.");
    expect(bulkInventoryError(error, createTranslator("ua"), "inventory.deleteFailed")).toBe("Серед вибраних є виріб, недоступний для цієї дії або вже проданий.");
    expect(bulkInventoryError({ code: "22023", message: "SOLD products cannot be moved." }, createTranslator("ua"), "inventory.moveFailed")).not.toMatch(/SOLD products|cannot be moved/);
  });

  it("keeps authorization and unexpected failures localized and distinct", () => {
    const ua = createTranslator("ua");
    expect(bulkInventoryError({ code: "42501", message: "forbidden" }, ua, "inventory.deleteFailed")).toBe(ua("inventory.ownerRequired"));
    expect(bulkInventoryError({ code: "XX000", message: "raw database failure" }, ua, "inventory.deleteFailed")).toBe(ua("inventory.deleteFailed"));
  });

  it("prefers authorized live names, then username snapshots, historical names, and System", () => {
    expect(historyActorName({ employees: { full_name: "admin" }, changed_by_username: "owner", changed_by_name: "Owner" }, "System")).toBe("admin");
    expect(historyActorName({ employees: null, changed_by_username: "admin", changed_by_name: "Owner" }, "System")).toBe("admin");
    expect(historyActorName({ employees: null, changed_by_username: null, changed_by_name: "Former Owner" }, "System")).toBe("Former Owner");
    expect(historyActorName({}, "System")).toBe("System");
  });

  it("does not weaken employee or history RLS", () => {
    const snapshots = readFileSync(new URL("../../../supabase/migrations/20260912200000_task13_account_shop_deletion.sql", import.meta.url), "utf8");
    const security = readFileSync(new URL("../../../supabase/migrations/20260923120000_bulk_purchase_price.sql", import.meta.url), "utf8");
    expect(snapshots).toContain("changed_by_username");
    expect(security).toContain("create policy inventory_history_select");
    expect(security).toContain("public.can_access_shop(i.shop_id)");
  });
});
