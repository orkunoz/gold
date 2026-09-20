import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("ZLATA V2.2 dark visual system", () => {
  it("routes utility colors through runtime theme tokens", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain("--color-stone-50: var(--zl-stone-50)");
    expect(css).toContain("--color-stone-950: var(--zl-stone-950)");
    expect(css).toContain("--color-amber-50: var(--zl-amber-50)");
    expect(css).toContain("--color-amber-950: var(--zl-amber-950)");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("--zl-page: #151412");
    expect(css).toContain("--zl-text: #f3ede4");
    expect(css).toContain("--zl-border: #3d3933");
  });

  it("covers shared dark controls, feedback, charts, and brand treatment", () => {
    const css = source("src/app/globals.css");
    const layout = source("src/app/(protected)/layout.tsx");
    const chart = source("src/components/sales-trend.tsx");
    expect(css).toContain("main input:not");
    expect(css).toContain("main option");
    expect(css).toContain('[data-theme="dark"] .bg-red-50');
    expect(css).toContain('[data-theme="dark"] .bg-emerald-50');
    expect(css).toContain(".zl-chart-grid");
    expect(layout).toContain("zl-brand-logo");
    expect(chart).toContain("zl-chart-grid");
    expect(chart).not.toContain("rgba(168,162,158,0.12)");
  });

  it("keeps printable business documents explicitly light", () => {
    const transfer = source("src/components/transfer-note.tsx");
    const transferPdf = source("src/lib/transfers/pdf.tsx");
    const receiptPdf = source("src/lib/added-products/pdf.tsx");
    expect(transfer).toContain("background:#fff;color:#2f2118");
    expect(transfer).toContain("html,body{background:#fff!important}");
    expect(transferPdf).toContain('name="color-scheme" content="light"');
    expect(receiptPdf).toContain('name="color-scheme" content="light"');
  });

  it("retains explicit two-state persistence without system mode", () => {
    const layout = source("src/app/layout.tsx");
    const toggle = source("src/components/theme-toggle.tsx");
    expect(layout).toContain("localStorage.getItem('zlata-theme')==='dark'?'dark':'light'");
    expect(toggle).toContain('type Theme = "light" | "dark"');
    expect(toggle).toContain('localStorage.setItem("zlata-theme", next)');
    expect(layout + toggle).not.toContain("prefers-color-scheme");
  });
});
