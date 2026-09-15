"use client";

import { useEffect, useId, useRef, useState } from "react";

export function CreatableCombobox({ value, options, onChange, label, inputRef, invalid = false }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
  inputRef?: (node: HTMLInputElement | null) => void;
  invalid?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filtered = options.filter((option) => option.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())).slice(0, 100);
  const exact = options.some((option) => option.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
  const choices = value.trim() && !exact ? [value.trim(), ...filtered] : filtered;

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(next: string) { onChange(next); setOpen(false); setActive(0); }
  return <div ref={root} className="relative">
    <input ref={inputRef} role="combobox" aria-label={label} aria-controls={id} aria-expanded={open} aria-autocomplete="list" aria-activedescendant={open && choices[active] ? `${id}-${active}` : undefined} aria-invalid={invalid}
      value={value} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(0); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, choices.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
        if (event.key === "Enter" && open && choices[active]) { event.preventDefault(); choose(choices[active]); }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      }}
      className={`mt-1.5 h-10 w-full min-w-0 rounded-lg border bg-white px-3 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 ${invalid ? "border-red-600 ring-1 ring-red-600" : "border-stone-300"}`} />
    {open && choices.length ? <ul id={id} role="listbox" className="absolute z-30 mt-1 max-h-[300px] w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-xl">
      {choices.map((option, index) => <li id={`${id}-${index}`} role="option" aria-selected={option === value} key={`${option}-${index}`} onMouseDown={(event) => { event.preventDefault(); choose(option); }} onMouseEnter={() => setActive(index)} className={`cursor-pointer rounded px-3 py-2 text-sm ${index === active ? "bg-amber-100" : ""} ${option === value ? "font-semibold text-amber-900" : ""}`}>{option}</li>)}
    </ul> : null}
  </div>;
}
