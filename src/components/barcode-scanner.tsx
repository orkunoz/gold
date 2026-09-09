"use client";

import { FormEvent, useEffect, useRef } from "react";
import { scannerSubmissionValue } from "@/lib/inventory/scanner";

export function BarcodeScanner({ initialValue = "", notFound = false }: { initialValue?: string; notFound?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (notFound) inputRef.current?.select();
  }, [notFound]);

  function submit(event: FormEvent<HTMLFormElement>) {
    const input = inputRef.current;
    if (!input) return;
    const barcode = scannerSubmissionValue(input.value);
    if (!barcode) {
      event.preventDefault();
      input.focus();
      return;
    }
    input.value = barcode;
  }

  return <form action="/inventory" method="get" onSubmit={submit} className="rounded-xl border-2 border-amber-700 bg-amber-50 p-5 shadow-sm">
    <input type="hidden" name="mode" value="exact" />
    <label htmlFor="scan-barcode" className="block text-base font-semibold text-stone-950">Scan barcode</label>
    <p className="mt-1 text-sm text-stone-600">Scan with a USB scanner or type a barcode and press Enter.</p>
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <input
        ref={inputRef}
        id="scan-barcode"
        name="barcode"
        type="search"
        autoComplete="off"
        spellCheck={false}
        defaultValue={initialValue}
        placeholder="Scan or type barcode"
        className="min-w-0 flex-1 rounded-lg border border-amber-800 bg-white px-4 py-3 text-lg font-medium outline-none ring-amber-500 focus:ring-2"
      />
      <button className="rounded-lg bg-amber-800 px-6 py-3 font-medium text-white hover:bg-amber-900">Open item</button>
    </div>
    {notFound ? <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-900">Barcode not found</p> : null}
  </form>;
}
