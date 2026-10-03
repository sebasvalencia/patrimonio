import { afterEach, describe, expect, it, vi } from "vitest";

async function loadI18n(prepare: () => void) {
  vi.resetModules();
  localStorage.clear();
  prepare();
  const mod = await import("./i18n");
  await mod.default.changeLanguage(mod.default.language);
  return mod;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("initial language", () => {
  it("uses a stored language", async () => {
    const { default: i18n } = await loadI18n(() => localStorage.setItem("stocks.lang", "en"));
    expect(i18n.language).toBe("en");
  });

  it("accepts the previous storage key", async () => {
    const { default: i18n } = await loadI18n(() => localStorage.setItem("acciones.lang", "it"));
    expect(i18n.language).toBe("it");
  });

  it("follows the browser when nothing is stored", async () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    const english = await loadI18n(() => undefined);
    expect(english.default.language.startsWith("en")).toBe(true);

    vi.stubGlobal("navigator", { language: "it-IT" });
    const italian = await loadI18n(() => undefined);
    expect(italian.default.language.startsWith("it")).toBe(true);

    vi.stubGlobal("navigator", { language: "fr-FR" });
    const spanish = await loadI18n(() => undefined);
    expect(spanish.default.language.startsWith("es")).toBe(true);
  });

  it("stores the chosen language and falls back for an unknown code", async () => {
    const { default: i18n, setLanguage } = await loadI18n(() => undefined);
    setLanguage("en");
    expect(localStorage.getItem("stocks.lang")).toBe("en");
    await i18n.changeLanguage("de");
    expect(document.documentElement.lang).toBe("es");
    expect(document.title).toBe("Acciones");
  });
});
