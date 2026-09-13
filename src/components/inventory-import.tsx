"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Tables } from "@/lib/database.types";
import { IMPORT_FIELDS, type ColumnMapping, type ImportPreview, type ParsedSheet } from "@/lib/inventory/import/types";
import { useI18n } from "./i18n-provider";

type Result = { imported: number; skipped: number; footerSkipped: number; duplicates: number; failed: number; failures: { row: number; message: string }[] };
type Props = { employeeShopId: string | null; shops: Pick<Tables<"shops">, "id" | "name" | "code">[] };

const fieldKeys: Partial<Record<typeof IMPORT_FIELDS[number], string>> = {
  category: "productCategory", producer: "producer", size: "size", purchase_price:"purchasePrice",
  weight_grams: "weight", price_per_gram: "pricePerGram", article_number: "article", status: "status", shop: "shop", barcode: "barcode",
};
class ImportRequestError extends Error {}

export function InventoryImport({ employeeShopId, shops }: Props) {
  const {t}=useI18n();
  async function jsonResponse<T>(response: Response): Promise<T> {
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new ImportRequestError(body.error || t("errors.generic"));
    return body;
  }

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [targetShopId] = useState(employeeShopId ?? shops[0]?.id ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const step = result ? 5 : preview ? 4 : parsed ? 3 : file ? 2 : 1;

  async function parse(selectedFile: File, sheet?: string) {
    setBusy(true); setError(""); setPreview(null); setResult(null);
    const form = new FormData(); form.set("file", selectedFile); if (sheet) form.set("sheet", sheet);
    try {
      const data = await jsonResponse<ParsedSheet>(await fetch("/api/inventory/import/parse", { method: "POST", body: form }));
      setParsed(data); setMapping(data.suggestedMapping);
    } catch (caught) { setError(caught instanceof ImportRequestError ? caught.message : t("import.readError")); }
    finally { setBusy(false); }
  }

  async function chooseFile(selected: File | null) {
    setFile(selected); setParsed(null); setPreview(null); setResult(null); setError("");
    if (selected) await parse(selected);
  }

  const payload = useMemo(() => parsed ? { rows: parsed.rows, sourceRows: parsed.sourceRows, mapping, targetShopId, headerRow: parsed.headerRow } : null, [parsed, mapping, targetShopId]);

  async function validate() {
    if (!payload) return;
    if (!targetShopId) { setError(t("import.selectTarget")); return; }
    setBusy(true); setError("");
    try { setPreview(await jsonResponse<ImportPreview>(await fetch("/api/inventory/import/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }))); }
    catch (caught) { setError(caught instanceof ImportRequestError ? caught.message : t("import.validateError")); }
    finally { setBusy(false); }
  }

  async function execute() {
    if (!payload || !preview) return;
    setBusy(true); setError("");
    try { setResult(await jsonResponse<Result>(await fetch("/api/inventory/import/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }))); }
    catch (caught) { setError(caught instanceof ImportRequestError ? caught.message : t("import.executeError")); }
    finally { setBusy(false); }
  }

  const importable = preview ? preview.summary.ready + preview.summary.warnings : 0;
  return <div>
    <ol className="grid grid-cols-5 gap-2" aria-label={t("import.title")}>
      {[t("import.file"),t("import.worksheet"),t("import.mapping"),t("import.preview"),t("import.result")].map((label, index) => <li key={label} className={`rounded-lg px-2 py-2 text-center text-xs font-medium ${step >= index + 1 ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-500"}`}>{index + 1}. {label}</li>)}
    </ol>
    {error ? <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

    {!result ? <div className="mt-8 space-y-8">
      <section><h2 className="text-lg font-semibold">1. {t("import.file")}</h2><p className="mt-1 text-sm text-stone-600">{t("import.fileHint")}</p>
        <label className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-stone-300 bg-white p-3 text-sm focus-within:ring-2 focus-within:ring-amber-700"><span>{t("import.chooseFile")}</span>{file ? <span>{file.name}</span> : null}<input aria-label={t("import.chooseFile")} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} className="sr-only" /></label>
      </section>

      {parsed && file ? <><section><h2 className="text-lg font-semibold">2. {t("import.worksheet")}</h2>
        <select aria-label={t("import.worksheet")} value={parsed.selectedSheet} disabled={busy} onChange={(event) => void parse(file, event.target.value)} className="mt-3 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2.5">
          {parsed.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
        </select><p className="mt-2 text-sm text-stone-500">{t("import.detectedHeaders",{row:parsed.headerRow+1,count:parsed.rows.length})}</p>
      </section>

      <section><h2 className="text-lg font-semibold">3. {t("import.mapping")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parsed.headers.map((header, sourceIndex) => { const selected = IMPORT_FIELDS.find((field) => mapping[field] === sourceIndex) ?? ""; return <label key={`${header}-${sourceIndex}`} className="text-sm font-medium">{header}
            <select value={selected} onChange={(event) => { const target = event.target.value as typeof IMPORT_FIELDS[number] | ""; setMapping((current) => { const next = { ...current }; IMPORT_FIELDS.forEach((field) => { if (next[field] === sourceIndex || field === target) delete next[field]; }); if (target) next[target] = sourceIndex; return next; }); }} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">
              <option value="">{t("import.doNotImport")}</option>{IMPORT_FIELDS.filter(field=>!["metal","fineness","discount","notes"].includes(field)).map((field) => <option key={field} value={field}>{t(`fields.${fieldKeys[field]}`)}</option>)}
            </select>
          </label>; })}
        </div>
      </section>

      <p className="rounded-lg bg-amber-50 p-4 text-sm">{t("import.warehouseDestination")}</p>
      <button disabled={busy} onClick={() => void validate()} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? t("common.loading") : t("import.validate")}</button></> : null}

      {preview ? <section className="border-t border-stone-200 pt-8"><h2 className="text-lg font-semibold">4. {t("import.preview")}</h2>
        <p className="mt-2 text-sm text-stone-600">{t("import.sourceHint")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{Object.entries(preview.summary).map(([label, value]) => <div key={label} className="rounded-lg bg-stone-100 p-3"><div className="text-2xl font-semibold">{value}</div><div className="text-xs text-stone-600">{t(`import.summary.${label}`)}</div></div>)}</div>
        <div className="mt-5 max-h-96 overflow-auto rounded-lg border border-stone-200"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="sticky top-0 bg-stone-50"><tr>{["import.sourceRow","import.result","fields.productCategory","fields.article","fields.producer","fields.size","fields.weight","fields.purchasePrice","fields.pricePerGram","import.price","fields.status","fields.shop","fields.barcode","import.issues"].map(heading=><th key={heading} className="px-3 py-2">{t(heading)}</th>)}</tr></thead><tbody>{preview.rows.slice(0,200).map(row=><tr key={row.sourceRow}>{[row.sourceRow,t(`import.${row.classification.toLowerCase()}`),row.item?.category_name,row.item?.article_number,row.item?.producer,row.item?.size,row.item?.weight_grams,row.item?.purchase_price,row.item?.price_per_gram,row.item?.price,row.item?t(`status.${row.item.status}`):null,row.item?.shop_name,row.item?.barcode,[...row.errors,...row.warnings].join("; ")].map((value,index)=><td key={index} className="px-3 py-2">{value??"—"}</td>)}</tr>)}</tbody></table></div>
        {preview.rows.length > 200 ? <p className="mt-2 text-sm text-stone-500">{t("import.previewLimit")}</p> : null}
        <button disabled={busy || importable === 0} onClick={() => void execute()} className="mt-5 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? t("import.importing") : t("import.importValid",{count:importable})}</button>
      </section> : null}
    </div> : <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-xl font-semibold">{t("import.result")}</h2>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5"><div><dt className="text-xs text-stone-600">{t("import.imported")}</dt><dd className="text-2xl font-semibold">{result.imported}</dd></div><div><dt className="text-xs text-stone-600">{t("import.validationSkipped")}</dt><dd className="text-2xl font-semibold">{result.skipped}</dd></div><div><dt className="text-xs text-stone-600">{t("import.footerSkipped")}</dt><dd className="text-2xl font-semibold">{result.footerSkipped}</dd></div><div><dt className="text-xs text-stone-600">{t("import.duplicates")}</dt><dd className="text-2xl font-semibold">{result.duplicates}</dd></div><div><dt className="text-xs text-stone-600">{t("import.databaseFailures")}</dt><dd className="text-2xl font-semibold">{result.failed}</dd></div></dl>
      {result.failures.length ? <ul className="mt-4 text-sm text-red-800">{result.failures.map((failure) => <li key={`${failure.row}-${failure.message}`}>{t("import.rowFailure",{row:failure.row,message:failure.message})}</li>)}</ul> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/inventory" className="rounded-lg bg-stone-900 px-5 py-2.5 text-center text-sm font-medium text-white">{t("import.return")}</Link><button onClick={() => { setFile(null); setParsed(null); setPreview(null); setResult(null); }} className="rounded-lg px-5 py-2.5 text-sm font-medium">{t("import.another")}</button></div>
    </section>}
  </div>;
}
