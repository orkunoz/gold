import { describe, expect, it, vi } from "vitest";
import {
  clearManualDrafts,
  loadManualDrafts,
  MANUAL_DRAFT_LIMIT,
  MANUAL_DRAFT_MAX_AGE_MS,
  manualDraftStorageKey,
  saveManualDrafts,
  type StoredDraft,
} from "./draft-storage";

const draft: StoredDraft = {
  id: "draft-1", shop_id: "warehouse", category_name: "Каблучка", article_number: "A1",
  producer: "Maker", size: "17", weight_grams: "2.4", purchase_price: "1000",
  price_per_gram: "1500", barcode: "001234",
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("manual Add Product draft persistence", () => {
  it("survives refresh, navigation, and browser restart simulations", () => {
    const storage = memoryStorage();
    saveManualDrafts(storage, "owner-a", [draft], 10_000);
    expect(loadManualDrafts(storage, "owner-a", 10_001)).toEqual([draft]);
    expect(loadManualDrafts(storage, "owner-a", 10_002)).toEqual([draft]);
    expect(loadManualDrafts(storage, "owner-a", 10_003)).toEqual([draft]);
  });

  it("scopes drafts to a stable Owner id", () => {
    const storage = memoryStorage();
    saveManualDrafts(storage, "owner-a", [draft]);
    expect(loadManualDrafts(storage, "owner-b")).toEqual([]);
    expect(manualDraftStorageKey("owner-a")).not.toBe(manualDraftStorageKey("owner-b"));
  });

  it("persists edits, removals, and shop changes", () => {
    const storage = memoryStorage();
    saveManualDrafts(storage, "owner-a", [{ ...draft, shop_id: "shop-2", producer: "Edited" }]);
    expect(loadManualDrafts(storage, "owner-a")[0]).toMatchObject({ shop_id: "shop-2", producer: "Edited" });
    saveManualDrafts(storage, "owner-a", []);
    expect(loadManualDrafts(storage, "owner-a")).toEqual([]);
  });

  it("expires stale data and rejects corrupt, incompatible, and oversized data", () => {
    const storage = memoryStorage(), key = manualDraftStorageKey("owner-a");
    saveManualDrafts(storage, "owner-a", [draft], 1_000);
    expect(loadManualDrafts(storage, "owner-a", 1_000 + MANUAL_DRAFT_MAX_AGE_MS + 1)).toEqual([]);
    storage.setItem(key, "not-json");
    expect(loadManualDrafts(storage, "owner-a")).toEqual([]);
    storage.setItem(key, JSON.stringify({ version: 999, savedAt: Date.now(), drafts: [draft] }));
    expect(loadManualDrafts(storage, "owner-a")).toEqual([]);
    storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), drafts: Array(MANUAL_DRAFT_LIMIT + 1).fill(draft) }));
    expect(loadManualDrafts(storage, "owner-a")).toEqual([]);
  });

  it("never breaks product entry when storage is unavailable or full", () => {
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }), setItem: vi.fn(() => { throw new Error("full"); }), removeItem: vi.fn(() => { throw new Error("blocked"); }) };
    expect(() => saveManualDrafts(storage, "owner-a", [draft])).not.toThrow();
    expect(() => clearManualDrafts(storage, "owner-a")).not.toThrow();
    expect(loadManualDrafts(storage, "owner-a")).toEqual([]);
  });

  it("accepts exactly 100 valid drafts", () => {
    const storage = memoryStorage(), drafts = Array.from({ length: MANUAL_DRAFT_LIMIT }, (_, index) => ({ ...draft, id: `draft-${index}` }));
    saveManualDrafts(storage, "owner-a", drafts);
    expect(loadManualDrafts(storage, "owner-a")).toHaveLength(100);
  });
});

