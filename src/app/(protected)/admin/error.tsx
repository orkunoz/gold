"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return <section className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-semibold text-red-950">Administration could not be loaded</h1><p className="mt-2 text-sm text-red-800">Administrative data is temporarily unavailable. No settings were changed.</p><button onClick={reset} className="mt-5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white">Try again</button></section>;
}
