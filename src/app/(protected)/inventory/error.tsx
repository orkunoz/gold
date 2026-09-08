"use client";

export default function InventoryError({ reset }: { reset: () => void }) {
  return <section className="max-w-lg rounded-xl border border-red-200 bg-white p-8"><h1 className="text-2xl font-semibold">Inventory could not be loaded</h1><p className="mt-3 text-sm leading-6 text-stone-600">Please try again. Your data was not changed.</p><button onClick={reset} className="mt-6 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white">Try again</button></section>;
}
