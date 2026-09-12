import { describe, expect, it } from "vitest";
import en from "../../../locales/en.json";
import ua from "../../../locales/ua.json";
import { DEFAULT_LOCALE, LANGUAGE_COOKIE, normalizeLocale, translate } from "./core";

describe("localization", () => {
  it("defaults first-time users to Ukrainian", () => {
    expect(DEFAULT_LOCALE).toBe("ua");
    expect(normalizeLocale(undefined)).toBe("ua");
    expect(normalizeLocale("invalid")).toBe("ua");
  });

  it("switches to English and uses a persistent preference cookie", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(LANGUAGE_COOKIE).toBe("zlata-language");
  });

  it("falls back to English when a Ukrainian key is missing", () => {
    (en as Record<string, unknown>).fallbackTest = { onlyEnglish: "English fallback" };
    expect(translate("ua", "fallbackTest.onlyEnglish")).toBe("English fallback");
  });

  it("provides key business labels and status wording", () => {
    expect(translate("ua", "fields.productCategory")).toBe("Виріб");
    expect(translate("ua", "fields.pricePerGram")).toBe("Ціна за грам");
    expect(translate("ua", "status.IN_STOCK")).toBe("В наявності");
    expect(translate("ua", "status.SOLD")).toBe("Продано");
    expect(translate("ua", "status.REMOVED")).toBe("Видалено");
    expect(ua.auth.welcome).toBeTruthy();
  });
});
