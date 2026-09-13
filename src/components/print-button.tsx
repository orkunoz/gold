"use client";export function PrintButton({label}:{label:string}){return <button type="button" onClick={()=>window.print()} className="rounded border px-4 py-2 print:hidden">{label}</button>}
