import { describe, expect, it } from "vitest";
import type { FxRate } from "./api";
import { asMoneyCurrency, convertCop, convertMoney, formatMoney, formatNumber, numberLocale } from "./format";
import i18n from "./i18n";

const rate: FxRate = { id: 1, year: 2026, month: 9, cop_per_usd: "4000" };

describe("convertMoney", () => {
  it("returns the amount when the currency does not change", () => {
    expect(convertMoney(10000, "COP", "COP", null, null, [])).toBe(10000);
  });

  it("divides COP by the month TRM to get USD", () => {
    expect(convertMoney(10000, "COP", "USD", 2026, 9, [rate])).toBe(2.5);
  });

  it("multiplies USD by the month TRM to get COP", () => {
    expect(convertMoney(2, "USD", "COP", 2026, 9, [rate])).toBe(8000);
  });

  it("returns null when the year, the month, or that month's rate is missing", () => {
    expect(convertMoney(10000, "COP", "USD", null, 9, [rate])).toBeNull();
    expect(convertMoney(10000, "COP", "USD", 2026, null, [rate])).toBeNull();
    expect(convertMoney(10000, "COP", "USD", 2026, 8, [rate])).toBeNull();
  });

  it("treats a rate of zero or less as missing", () => {
    const zero: FxRate = { ...rate, cop_per_usd: "0" };
    const negative: FxRate = { ...rate, cop_per_usd: "-1" };
    expect(convertMoney(10000, "COP", "USD", 2026, 9, [zero])).toBeNull();
    expect(convertMoney(10000, "COP", "USD", 2026, 9, [negative])).toBeNull();
  });
});

describe("display helpers", () => {
  it("treats only USD as dollars and formats both currencies", async () => {
    expect(asMoneyCurrency("USD")).toBe("USD");
    expect(asMoneyCurrency("COP")).toBe("COP");
    expect(asMoneyCurrency(null)).toBe("COP");
    expect(asMoneyCurrency(undefined)).toBe("COP");

    await i18n.changeLanguage("en");
    expect(numberLocale()).toBe("en-US");
    await i18n.changeLanguage("it");
    expect(numberLocale()).toBe("it-IT");
    await i18n.changeLanguage("es");
    expect(numberLocale()).toBe("es-CO");

    expect(formatNumber(1500)).toMatch(/1/);
    expect(formatMoney(1000.5)).toMatch(/1/);
    expect(formatMoney(10.5, "USD")).toMatch(/10/);
    expect(convertCop(8000, "COP", null, null, [])).toBe(8000);
    expect(convertCop(8000, "USD", 2026, 9, [rate])).toBe(2);
  });
});
