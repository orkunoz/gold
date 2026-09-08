export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <section>
    <p className="text-xs font-medium uppercase tracking-widest text-stone-500">Your workspace</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
    <div className="mt-8 rounded-xl border border-stone-200 bg-white p-8">
      <h2 className="font-medium">Coming soon</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-stone-600">{description}</p>
    </div>
  </section>;
}
