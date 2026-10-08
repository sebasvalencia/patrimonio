import { ES, GB, IT } from "country-flag-icons/react/3x2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCurrency } from "./currency";
import type { DisplayCurrency } from "./format";
import { isLang, LANGS, setLanguage, type Lang } from "./i18n";
import { useTheme } from "./theme";
import Catalog from "./pages/Catalog";
import FxRates from "./pages/FxRates";
import Prices from "./pages/Prices";
import Summary from "./pages/Summary";
import Trades from "./pages/Trades";
import FundsCatalog from "./pages/funds/Catalog";
import FundsPrices from "./pages/funds/Prices";
import FundsTrades from "./pages/funds/Trades";
import ReserveBalances from "./pages/reserves/Balances";
import ReservesCatalog from "./pages/reserves/Catalog";
import CdtsCatalog from "./pages/cdts/Catalog";
import Patrimonio from "./pages/Patrimonio";

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-accent text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
  }`;

const CURRENCIES: DisplayCurrency[] = ["COP", "USD"];

const compactSelect =
  "rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink";

function ThemeIcon({ mode }: { mode: "dark" | "light" }) {
  if (mode === "dark") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

const LANGUAGE_FLAGS = { es: ES, en: GB, it: IT } as const;

function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lang: Lang = isLang(i18n.language) ? i18n.language : "es";
  const CurrentFlag = LANGUAGE_FLAGS[lang];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current!.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={t("lang.label")}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center justify-center rounded border border-line bg-surface-2 p-1"
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentFlag className="h-4 w-6" aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("lang.label")}
          className="absolute right-0 z-20 mt-1 min-w-36 rounded border border-line bg-surface-2 py-1 text-xs text-ink shadow-md"
        >
          {LANGS.map((code) => {
            const Flag = LANGUAGE_FLAGS[code];
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={code === lang}
                  className={`flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-surface ${code === lang ? "bg-surface" : ""}`}
                  onClick={() => {
                    setLanguage(code);
                    setOpen(false);
                  }}
                >
                  <Flag className="h-4 w-6" aria-hidden="true" />
                  {t(`lang.${code}`)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type ModuleName = "equities" | "funds" | "reserves" | "cdts";

const PAIRS: Record<string, Partial<Record<ModuleName, string>>> = {
  "/": { funds: "/funds", reserves: "/reserves", cdts: "/cdts" },
  "/funds": { equities: "/", reserves: "/reserves", cdts: "/cdts" },
  "/reserves": { equities: "/", funds: "/funds", cdts: "/cdts" },
  "/cdts": { equities: "/", funds: "/funds", reserves: "/reserves" },
  "/prices": { funds: "/funds/prices", reserves: "/reserves/balances", cdts: "/cdts/catalog" },
  "/trades": { funds: "/funds/trades", reserves: "/reserves/balances", cdts: "/cdts/catalog" },
  "/catalog": { funds: "/funds/catalog", reserves: "/reserves/catalog", cdts: "/cdts/catalog" },
  "/funds/prices": { equities: "/prices", reserves: "/reserves/balances", cdts: "/cdts/catalog" },
  "/funds/trades": { equities: "/trades", reserves: "/reserves/balances", cdts: "/cdts/catalog" },
  "/funds/catalog": { equities: "/catalog", reserves: "/reserves/catalog", cdts: "/cdts/catalog" },
  "/reserves/balances": { equities: "/prices", funds: "/funds/prices", cdts: "/cdts/catalog" },
  "/reserves/catalog": { equities: "/catalog", funds: "/funds/catalog", cdts: "/cdts/catalog" },
  "/cdts/catalog": { equities: "/catalog", funds: "/funds/catalog", reserves: "/reserves/catalog" },
};

export function counterpart(path: string, next: ModuleName): string {
  const mapped = PAIRS[path]?.[next];
  return mapped ?? path;
}

function moduleFromPath(path: string): ModuleName {
  if (path.startsWith("/cdts")) return "cdts";
  if (path.startsWith("/reserves")) return "reserves";
  if (path.startsWith("/funds")) return "funds";
  return "equities";
}

export default function App() {
  const { t } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleName>(moduleFromPath(location.pathname));
  const fundsMode = module === "funds";
  const reservesMode = module === "reserves";
  const cdtsMode = module === "cdts";

  useEffect(() => {
    if (location.pathname.startsWith("/cdts")) setModule("cdts");
    else if (location.pathname.startsWith("/reserves")) setModule("reserves");
    else if (location.pathname.startsWith("/funds")) setModule("funds");
    else if (["/prices", "/trades", "/catalog"].includes(location.pathname)) setModule("equities");
  }, [location.pathname]);

  function switchModule(next: ModuleName) {
    setModule(next);
    const dest = counterpart(location.pathname, next);
    if (dest !== location.pathname) navigate(dest);
  }

  return (
    <div className="min-h-screen bg-navy text-ink">
      <header className="border-b border-line bg-surface text-ink shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="font-display text-2xl tracking-wide">{t("app.title")}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  link({
                    isActive:
                      isActive ||
                      location.pathname === "/funds" ||
                      location.pathname === "/reserves" ||
                      location.pathname === "/cdts",
                  })
                }
                end
              >
                {t("nav.summary")}
              </NavLink>
              {cdtsMode ? null : reservesMode ? (
                <NavLink to="/reserves/balances" className={link}>
                  {t("nav.balances")}
                </NavLink>
              ) : (
                <>
                  <NavLink to={fundsMode ? "/funds/prices" : "/prices"} className={link}>
                    {t("nav.prices")}
                  </NavLink>
                  <NavLink to={fundsMode ? "/funds/trades" : "/trades"} className={link}>
                    {t("nav.trades")}
                  </NavLink>
                </>
              )}
              <NavLink
                to={
                  cdtsMode
                    ? "/cdts/catalog"
                    : reservesMode
                      ? "/reserves/catalog"
                      : fundsMode
                        ? "/funds/catalog"
                        : "/catalog"
                }
                className={link}
              >
                {t("nav.catalog")}
              </NavLink>
              <NavLink to="/fx" className={link}>
                {t("nav.fx")}
              </NavLink>
              <NavLink to="/patrimonio" className={link}>
                {t("nav.patrimonio")}
              </NavLink>
            </nav>
            <select
              aria-label={t("nav.module")}
              className={compactSelect}
              value={module}
              onChange={(e) => switchModule(e.target.value as ModuleName)}
            >
              <option value="equities">{t("nav.equities")}</option>
              <option value="funds">{t("nav.funds")}</option>
              <option value="reserves">{t("nav.reserves")}</option>
              <option value="cdts">{t("nav.cdts")}</option>
            </select>
            <select
              aria-label={t("currency.label")}
              className={compactSelect}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {t(`currency.${c.toLowerCase()}`)}
                </option>
              ))}
            </select>
            <LanguageMenu />
            <button
              type="button"
              aria-label={t("theme.label")}
              className="ml-auto inline-flex items-center justify-center rounded border border-line bg-surface-2 p-1 text-ink"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <ThemeIcon mode={theme} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Summary />} />
          <Route path="/prices" element={<Prices />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/fx" element={<FxRates />} />
          <Route path="/funds" element={<Summary />} />
          <Route path="/funds/prices" element={<FundsPrices />} />
          <Route path="/funds/trades" element={<FundsTrades />} />
          <Route path="/funds/catalog" element={<FundsCatalog />} />
          <Route path="/reserves" element={<Summary />} />
          <Route path="/reserves/catalog" element={<ReservesCatalog />} />
          <Route path="/reserves/balances" element={<ReserveBalances />} />
          <Route path="/cdts" element={<Summary />} />
          <Route path="/cdts/catalog" element={<CdtsCatalog />} />
          <Route path="/patrimonio" element={<Patrimonio />} />
          <Route path="/precios" element={<Navigate to="/prices" replace />} />
          <Route path="/movimientos" element={<Navigate to="/trades" replace />} />
          <Route path="/catalogo" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </main>
    </div>
  );
}
