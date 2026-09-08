"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg p-8">
    <h1 className="text-2xl font-semibold">Something went wrong</h1>
    <p className="my-4 text-stone-600">Please try again. If the problem continues, contact your administrator.</p>
    <button onClick={reset} className="rounded-lg bg-stone-900 px-4 py-2 text-white">Try again</button>
  </main>;
}
