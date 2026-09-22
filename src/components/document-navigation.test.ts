import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("document detail navigation",()=>{
 it("places Transfer's back link beside its existing PDF link outside the printable document",()=>{
  const page=read("../app/(protected)/transfers/[id]/page.tsx"),note=read("./transfer-note.tsx");
  expect(page).toContain('<Link href="/documents?type=transfers"');
  expect(page).toContain('← {t("transfers.title")}');
  expect(page).toContain("transfer-note-actions");
  expect(page).toContain("/api/transfers/${id}/pdf");
  expect(note).not.toContain('href="/documents?type=transfers"');
 });

 it("places Goods Receipt's back link beside its existing PDF link outside the printable document",()=>{
  const page=read("../app/(protected)/documents/added-products/[id]/page.tsx"),note=read("./added-products-note.tsx");
  expect(page).toContain('<Link href="/documents?type=added"');
  expect(page).toContain('← {t("addedProducts.title")}');
  expect(page).toContain("transfer-note-actions");
  expect(page).toContain("/api/added-products/${id}/pdf");
  expect(note).not.toContain('href="/documents?type=added"');
 });
});
