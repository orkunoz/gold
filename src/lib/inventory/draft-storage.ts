import type { DraftProduct } from "./actions";

export const MANUAL_DRAFT_LIMIT = 100;
export const MANUAL_DRAFT_VERSION = 1;
export const MANUAL_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "zlata:add-product-drafts";

export type StoredDraft = DraftProduct & { id: string };
type PersistedDraftBasket = {
  version: typeof MANUAL_DRAFT_VERSION;
  savedAt: number;
  drafts: StoredDraft[];
};

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const draftFields: (keyof DraftProduct)[] = [
  "shop_id", "category_name", "article_number", "producer", "size",
  "weight_grams", "purchase_price", "price_per_gram", "barcode",
];

export function manualDraftStorageKey(ownerId: string) {
  return `${STORAGE_PREFIX}:v${MANUAL_DRAFT_VERSION}:${ownerId}`;
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.id === "string" && draft.id.length > 0
    && draftFields.every((field) => typeof draft[field] === "string");
}

export function loadManualDrafts(storage: BrowserStorage, ownerId: string, now = Date.now()): StoredDraft[] {
  const key = manualDraftStorageKey(ownerId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw) as Partial<PersistedDraftBasket>;
    if (value.version !== MANUAL_DRAFT_VERSION || typeof value.savedAt !== "number" || !Array.isArray(value.drafts)
      || value.drafts.length > MANUAL_DRAFT_LIMIT || value.drafts.some((draft) => !isStoredDraft(draft))) {
      storage.removeItem(key);
      return [];
    }
    if (now - value.savedAt > MANUAL_DRAFT_MAX_AGE_MS || value.savedAt > now + 60_000) {
      storage.removeItem(key);
      return [];
    }
    return value.drafts;
  } catch {
    try { storage.removeItem(key); } catch { /* Storage can be blocked or unavailable. */ }
    return [];
  }
}

export function saveManualDrafts(storage: BrowserStorage, ownerId: string, drafts: StoredDraft[], now = Date.now()) {
  try {
    if (drafts.length === 0) {
      storage.removeItem(manualDraftStorageKey(ownerId));
      return;
    }
    const value: PersistedDraftBasket = { version: MANUAL_DRAFT_VERSION, savedAt: now, drafts };
    storage.setItem(manualDraftStorageKey(ownerId), JSON.stringify(value));
  } catch {
    // Persistence is recovery protection; in-memory product entry must continue.
  }
}

export function clearManualDrafts(storage: BrowserStorage, ownerId: string) {
  try { storage.removeItem(manualDraftStorageKey(ownerId)); } catch { /* Keep the UI usable. */ }
}

