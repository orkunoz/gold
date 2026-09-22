import type { ReactNode } from "react";
import Link from "next/link";

type Detail = { label: string; value: ReactNode };

export function DocumentDetailView({
  backHref,
  backLabel,
  title,
  documentNumber,
  downloadHref,
  downloadLabel,
  details,
  headings,
  rows,
  numericColumns,
  summary,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  documentNumber: string;
  downloadHref: string;
  downloadLabel: string;
  details: Detail[];
  headings: string[];
  rows: ReactNode[][];
  numericColumns: number[];
  summary: Detail[];
}) {
  const numeric = new Set(numericColumns);
  return <section>
    <Link href={backHref} className="text-sm font-medium text-stone-600">← {backLabel}</Link>
    <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-widest text-stone-500">{title}</p><h1 className="mt-2 text-2xl font-semibold sm:text-4xl">{documentNumber}</h1></div>
      <a className="rounded border border-amber-800 bg-white px-4 py-2 font-medium text-amber-900" href={downloadHref} download>{downloadLabel}</a>
    </header>
    <dl className="zl-surface mt-6 grid sm:grid-cols-2 lg:grid-cols-3">
      {details.map(({label,value})=><div key={label} className="border-b border-stone-200 p-4 last:border-b-0 sm:border-r"><dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-stone-900">{value}</dd></div>)}
    </dl>
    <div className="zl-table-wrap mt-6"><table className="zl-table zl-table--dense min-w-[1100px]"><thead><tr>{headings.map((heading,index)=><th key={`${heading}-${index}`} className={numeric.has(index)?"zl-table-number":""}>{heading}</th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((value,index)=><td key={index} className={numeric.has(index)?"zl-table-number whitespace-nowrap":""}>{value}</td>)}</tr>)}</tbody></table></div>
    <dl className="zl-surface mt-4 grid sm:grid-cols-3">
      {summary.map(({label,value})=><div key={label} className="p-4 sm:border-r sm:last:border-r-0"><dt className="text-xs font-medium text-stone-500">{label}</dt><dd className="zl-tabular mt-1 text-lg font-semibold text-stone-950">{value}</dd></div>)}
    </dl>
  </section>;
}
