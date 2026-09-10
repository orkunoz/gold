"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { InventoryStatus, Tables } from "@/lib/database.types";
import type { InventoryActionState } from "@/lib/inventory/actions";
import { INVENTORY_STATUSES, STATUS_LABELS } from "@/lib/inventory/constants";

type Action = (state: InventoryActionState, formData: FormData) => Promise<InventoryActionState>;
const INITIAL_INVENTORY_STATE: InventoryActionState = { error: "" };

type Props = {
  action: Action;
  categories: Pick<Tables<"product_categories">, "id" | "name">[];
  shops: Pick<Tables<"shops">, "id" | "name" | "code">[];
  item?: Tables<"inventory_items">;
  cancelHref: string;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-700">{message}</p> : null;
}

const inputClass = "mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-amber-700";
const labelClass = "block text-sm font-medium text-stone-800";

export function InventoryForm({ action, categories, shops, item, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL_INVENTORY_STATE);
  return <form action={formAction} className="space-y-8" aria-busy={pending}>
    {state.error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</div> : null}

    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>Shop <span className="text-red-700">*</span>
        <select name="shop_id" required defaultValue={item?.shop_id ?? (shops.length === 1 ? shops[0].id : "")} className={inputClass}>
          <option value="">Select shop</option>
          {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}{shop.code ? ` (${shop.code})` : ""}</option>)}
        </select>
        <FieldError message={state.fieldErrors?.shop_id} />
      </label>

      <label className={labelClass}>Barcode
        <input name="barcode" maxLength={200} autoFocus={!item} defaultValue={item?.barcode ?? ""} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-stone-500">Optional. A non-empty barcode must be unique and enables scanner lookup.</span>
        <FieldError message={state.fieldErrors?.barcode} />
      </label>

      <label className={labelClass}>Article number
        <input name="article_number" defaultValue={item?.article_number ?? ""} className={inputClass} />
      </label>

      <label className={labelClass}>Category
        <select name="category_id" defaultValue={item?.category_id ?? ""} className={inputClass}>
          <option value="">No category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>

      <label className={labelClass}>Metal
        <select name="metal" defaultValue={item?.metal ?? ""} className={inputClass}><option value="">Not specified</option><option value="Gold">Gold</option><option value="Silver">Silver</option></select>
        <FieldError message={state.fieldErrors?.metal} />
      </label>

      <label className={labelClass}>Producer
        <input name="producer" defaultValue={item?.producer ?? ""} className={inputClass} />
      </label>

      <label className={labelClass}>Gold fineness
        <input name="gold_fineness" inputMode="numeric" placeholder="585" defaultValue={item?.gold_fineness ?? ""} className={inputClass} />
      </label>

      <label className={labelClass}>Gold color
        <input name="gold_color" placeholder="Yellow" defaultValue={item?.gold_color ?? ""} className={inputClass} />
      </label>

      <label className={labelClass}>Weight, grams
        <input name="weight_grams" type="number" min="0" step="0.001" inputMode="decimal" defaultValue={item?.weight_grams ?? ""} className={inputClass} />
        <FieldError message={state.fieldErrors?.weight_grams} />
      </label>

      <label className={labelClass}>Size
        <input name="size" defaultValue={item?.size ?? ""} className={inputClass} />
      </label>

      <label className={labelClass}>Price per gram, UAH
        <input name="price_per_gram" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.price_per_gram ?? ""} className={inputClass} />
        <FieldError message={state.fieldErrors?.price_per_gram} />
      </label>

      <label className={labelClass}>Discount
        <input name="discount" defaultValue={item?.discount ?? ""} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-stone-500">Informational only; it does not alter the effective price.</span>
      </label>

      <label className={labelClass}>Owner/base price, UAH
        <input name="owner_price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.owner_price ?? ""} className={inputClass} />
        <FieldError message={state.fieldErrors?.owner_price} />
      </label>

      <label className={labelClass}>Manual customer price override, UAH
        <input name="selling_price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.selling_price ?? ""} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-stone-500">Leave blank to use the automatic pricing rule.</span>
        <FieldError message={state.fieldErrors?.selling_price} />
      </label>

      <label className={labelClass}>Status <span className="text-red-700">*</span>
        <select name="status" required defaultValue={(item?.status ?? "IN_STOCK") as InventoryStatus} className={inputClass}>
          {INVENTORY_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
        <FieldError message={state.fieldErrors?.status} />
      </label>

      <label className={labelClass}>Received date
        <input name="received_at" type="date" defaultValue={item?.received_at?.slice(0, 10) ?? ""} className={inputClass} />
        <FieldError message={state.fieldErrors?.received_at} />
      </label>
    </div>

    <label className={labelClass}>Notes
      <textarea name="notes" rows={4} defaultValue={item?.notes ?? ""} className={inputClass} />
    </label>

    <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-6">
      <button disabled={pending} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60">
        {pending ? "Saving…" : item ? "Save changes" : "Add product"}
      </button>
      <Link href={cancelHref} className="rounded-lg px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100">Cancel</Link>
    </div>
  </form>;
}
