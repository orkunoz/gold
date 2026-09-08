import Link from "next/link";

export default function InventoryItemNotFound() {
  return <section className="max-w-lg rounded-xl border border-stone-200 bg-white p-8"><h1 className="text-2xl font-semibold">Product not found</h1><p className="mt-3 text-sm leading-6 text-stone-600">The item does not exist or is outside your permitted shop.</p><Link href="/inventory" className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white">Back to inventory</Link></section>;
}
