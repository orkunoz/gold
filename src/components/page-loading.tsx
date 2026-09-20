export function PageLoading({ table = true }: { table?: boolean }) {
  return <section aria-busy="true" aria-label="Loading" className="space-y-6">
    <div className="zl-page-heading"><div className="zl-skeleton h-9 w-48 rounded-lg" /></div>
    <div className="zl-surface p-5"><div className="zl-skeleton h-10 w-full rounded-lg" />{table ? <div className="mt-5 space-y-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="zl-skeleton h-11 w-full rounded-md" />)}</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="zl-skeleton h-28 rounded-xl"/><div className="zl-skeleton h-28 rounded-xl"/></div>}</div>
  </section>;
}
