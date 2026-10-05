import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCurrency } from "./currency";
import type { DisplayCurrency } from "./format";
import { LANGS, setLanguage, type Lang } from "./i18n";
import { THEMES, useTheme } from "./theme";
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

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-accent text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
  }`;

const CURRENCIES: DisplayCurrency[] = ["COP", "USD"];

const compactSelect =
  "rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink";

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
  const { t, i18n } = useTranslation();
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
              aria-label={t("theme.label")}
              className={compactSelect}
              value={theme}
              onChange={(e) => setTheme(e.target.value as (typeof THEMES)[number])}
            >
              {THEMES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`theme.${mode}`)}
                </option>
              ))}
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
            <select
              aria-label={t("lang.label")}
              className={compactSelect}
              value={LANGS.includes(i18n.language as Lang) ? i18n.language : "es"}
              onChange={(e) => setLanguage(e.target.value as Lang)}
            >
              {LANGS.map((lng) => (
                <option key={lng} value={lng}>
                  {t(`lang.${lng}`)}
                </option>
              ))}
            </select>
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
          <Route path="/precios" element={<Navigate to="/prices" replace />} />
          <Route path="/movimientos" element={<Navigate to="/trades" replace />} />
          <Route path="/catalogo" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </main>
    </div>
  );
}
