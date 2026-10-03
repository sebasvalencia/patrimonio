import { describe, expect, it } from "vitest";
import { translateApiError } from "./apiErrors";

describe("translateApiError", () => {
  it("translates a known code", () => {
    expect(translateApiError("broker_not_found")).not.toBe("broker_not_found");
  });

  it("translates the older sell message", () => {
    const text = translateApiError("La venta supera el saldo de este corredor");
    expect(text).not.toContain("La venta supera");
  });

  it("returns an unknown message unchanged", () => {
    expect(translateApiError("algo raro")).toBe("algo raro");
  });
});
