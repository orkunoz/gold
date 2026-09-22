import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Serverless Chromium can substitute a font without U+20B4 for Arial. Embed
// only this glyph; all other text retains the document's existing font.
export function pdfCurrencyFontCss() {
  const font = readFileSync(join(process.cwd(), "public", "fonts", "geist-regular.ttf"));
  return `@font-face{font-family:"Zlata Currency";src:url(data:font/ttf;base64,${font.toString("base64")}) format("truetype");unicode-range:U+20B4}`;
}
