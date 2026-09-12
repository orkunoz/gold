import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./inventory-form.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/inventory/queries.ts", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/(protected)/inventory/[id]/page.tsx", import.meta.url), "utf8");

describe("dynamic inventory metal and producer inputs", () => {
  it.each(["metal", "producer"])("renders %s as an open text input", (name) => {
    expect(source).toMatch(new RegExp(`<input name=["']${name}["']`));
    expect(source).not.toMatch(new RegExp(`<select name=["']${name}["']`));
  });

  it("keeps existing values when editing", () => {
    expect(source).toContain('defaultValue={item?.metal??""}');
    expect(source).toContain('defaultValue={item?.producer??""}');
  });

  it("searches and displays both open-text values", () => {
    expect(queries).toContain("producer.ilike");
    expect(queries).toContain("metal.ilike");
    expect(detail).toContain('displayValue(item.producer)');
    expect(detail).toContain('displayValue(item.metal)');
  });
});
