export default function SalesLoading() {
  return <section aria-busy="true" aria-label="Loading sales" className="animate-pulse">
    <div className="h-9 w-40 rounded bg-stone-200" />
    <div className="mt-6 h-44 rounded-xl bg-stone-200" />
    <div className="mt-6 h-64 rounded-xl bg-stone-200" />
  </section>;
}
