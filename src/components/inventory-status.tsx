import type { InventoryStatus as Status } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/inventory/constants";

const colors: Record<Status, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  SOLD: "bg-red-50 text-red-700 ring-red-600/20",
  REMOVED: "bg-stone-100 text-stone-700 ring-stone-500/20",
};

export function InventoryStatus({ status }: { status: Status }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colors[status]}`}>
    {STATUS_LABELS[status]}
  </span>;
}
