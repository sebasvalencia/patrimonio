import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App, { counterpart } from "./App";
import BannerPrecios from "./BannerPrecios";
import { CurrencyProvider, useCurrency } from "./currency";
import type { FxRate, Position, Target, TargetProgress, Variation } from "./api";
import Catalog from "./pages/Catalog";
import FxRates from "./pages/FxRates";
import Prices from "./pages/Prices";
import PortfolioBlock from "./pages/PortfolioBlock";
import Summary from "./pages/Summary";
import Trades from "./pages/Trades";
import FundsCatalog from "./pages/funds/Catalog";
import FundsPrices from "./pages/funds/Prices";
import FundsTrades from "./pages/funds/Trades";
import ReserveBalances from "./pages/reserves/Balances";
import ReservesCatalog from "./pages/reserves/Catalog";
import CdtsCatalog from "./pages/cdts/Catalog";
import { applyTheme, chartTheme, readTheme, ThemeProvider, useTheme } from "./theme";
import i18n from "./i18n";

function ThemeButton() {
  const { setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("light")}>
      tema
    </button>
  );
}

const api = vi.hoisted(() => ({
  fxRates: vi.fn(),
  instruments: vi.fn(),
  brokers: vi.fn(),
  trades: vi.fn(),
  createInstrument: vi.fn(),
  createBroker: vi.fn(),
  patchInstrument: vi.fn(),
  patchBroker: vi.fn(),
  createTrade: vi.fn(),
  updateTrade: vi.fn(),
  deleteTrade: vi.fn(),
  prices: vi.fn(),
  upsertPrice: vi.fn(),
  pendingPrices: vi.fn(),
  pendingFundUnitValues: vi.fn(),
  wealth: vi.fn(),
  funds: vi.fn(),
  fiduciaries: vi.fn(),
  createFund: vi.fn(),
  createFiduciary: vi.fn(),
  patchFund: vi.fn(),
  patchFiduciary: vi.fn(),
  fundTrades: vi.fn(),
  createFundTrade: vi.fn(),
  updateFundTrade: vi.fn(),
  deleteFundTrade: vi.fn(),
  fundUnitValues: vi.fn(),
  upsertFundUnitValue: vi.fn(),
  variation: vi.fn(),
  targetProgress: vi.fn(),
  targets: vi.fn(),
  upsertTarget: vi.fn(),
  fundVariation: vi.fn(),
  fundTargetProgress: vi.fn(),
  fundTargets: vi.fn(),
  upsertFundTarget: vi.fn(),
  importOfficialFx: vi.fn(),
  upsertFxRate: vi.fn(),
  institutions: vi.fn(),
  createInstitution: vi.fn(),
  patchInstitution: vi.fn(),
  deleteInstitution: vi.fn(),
  reserveAccounts: vi.fn(),
  createReserveAccount: vi.fn(),
  patchReserveAccount: vi.fn(),
  deleteReserveAccount: vi.fn(),
  reserveBalances: vi.fn(),
  upsertReserveBalance: vi.fn(),
  banks: vi.fn(),
  createBank: vi.fn(),
  patchBank: vi.fn(),
  deleteBank: vi.fn(),
  cdts: vi.fn(),
  createCdt: vi.fn(),
  patchCdt: vi.fn(),
  deleteCdt: vi.fn(),
}));

vi.mock("./api", () => ({ api }));

const eco = { id: 1, name: "Ecopetrol", active: true, currency: "COP" as const };
const dormant = { id: 2, name: "ETB", active: false, currency: "USD" as const };
const broker = { id: 3, name: "Trii" };
const fund = { id: 4, name: "FIC Uno", active: true, currency: "COP" as const };
const fiduciary = { id: 5, name: "Fid Uno" };
const institution = { id: 80, name: "Protección" };
const otherInstitution = { id: 81, name: "Otra" };
const ceiba = {
  id: 70,
  name: "Ceiba",
  institution_id: 80,
  institution_name: "Protección",
  currency: "COP" as const,
  purpose: "official_pension" as const,
  liquid: false,
  active: true,
};
const apnea = {
  ...ceiba,
  id: 71,
  name: "Apnea",
  purpose: "emergency" as const,
  liquid: true,
  active: false,
};

const copPosition: Position = {
  instrument_id: 1,
  instrument_name: "Ecopetrol",
  broker_id: 3,
  broker_name: "Trii",
  balance: "10",
  last_price: "100",
  price_year: 2026,
  price_month: 9,
  value: "1000",
  weight_pct: "100",
  missing_price: false,
  instrument_currency: "COP",
};

const usdPosition: Position = {
  ...copPosition,
  instrument_id: 9,
  instrument_name: "AAPL",
  instrument_currency: "USD",
  value: "20",
  last_price: "20",
};

const missingPosition: Position = {
  ...copPosition,
  instrument_id: 2,
  instrument_name: "ETB",
  last_price: null,
  value: null,
  price_year: null,
  price_month: null,
  missing_price: true,
};

const variation: Variation = {
  instrument_id: 1,
  instrument_name: "Ecopetrol",
  instrument_currency: "COP",
  points: [
    { year: 2026, month: 8, price: "90", variation_pct: null },
    { year: 2026, month: 9, price: "100", variation_pct: "11" },
  ],
};

const progress: TargetProgress = {
  instrument_id: 1,
  instrument_name: "Ecopetrol",
  last_price: "100",
  price_year: 2026,
  price_month: 9,
  target: "80",
  target_year: 2026,
  target_month: 9,
  progress_pct: "150",
  instrument_currency: "COP",
};

const target: Target = {
  id: 7,
  instrument_id: 1,
  year: 2026,
  month: 9,
  price: "80",
  instrument_name: "Ecopetrol",
  instrument_currency: null,
};

function setInput(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement;
  const type = input.type;
  if (value === "" && type === "number") input.type = "text";
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  fireEvent.input(input, { target: { value } });
  input.type = type;
}

function shell(ui: ReactNode, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CurrencyProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </CurrencyProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("stocks.lang", "es");
  await i18n.changeLanguage("es");
  vi.clearAllMocks();
  api.fxRates.mockResolvedValue([] as FxRate[]);
  api.instruments.mockResolvedValue([eco, dormant]);
  api.brokers.mockResolvedValue([broker]);
  api.trades.mockResolvedValue([
    {
      id: 11,
      instrument_id: 1,
      broker_id: 3,
      type: "buy",
      year: 2026,
      month: 3,
      quantity: "10",
      commission: "1.5",
      price: "100",
      instrument_name: "Ecopetrol",
      broker_name: "Trii",
      instrument_currency: "COP",
    },
    {
      id: 12,
      instrument_id: 2,
      broker_id: 3,
      type: "sell",
      year: 2025,
      month: null,
      quantity: "2",
      commission: "0",
      price: null,
      instrument_name: "ETB",
      broker_name: "Trii",
      instrument_currency: "USD",
    },
  ]);
  api.prices.mockResolvedValue([
    { id: 21, instrument_id: 1, year: 2026, month: 1, price: "1000.5", instrument_name: "Ecopetrol", instrument_currency: "COP" },
  ]);
  api.pendingPrices.mockResolvedValue({
    year: 2026,
    month: 1,
    total_active: 2,
    pending: 2,
    missing: [{ instrument_id: 1, instrument_name: "Ecopetrol" }],
  });
  api.pendingFundUnitValues.mockResolvedValue({
    year: 2026,
    month: 1,
    total_active: 1,
    pending: 2,
    missing: [{ fund_id: 4, fund_name: "FIC Uno" }],
  });
  api.wealth.mockResolvedValue({
    total: null,
    equities: { total: "1000", positions: [copPosition, usdPosition, missingPosition] },
    funds: { total: "500", positions: [{ ...copPosition, instrument_name: "FIC Uno", instrument_id: 4 }] },
    reserves: {
      total: "1000",
      positions: [
        {
          ...copPosition,
          instrument_id: 70,
          instrument_name: "Ceiba",
          broker_id: 80,
          broker_name: "Protección",
          last_price: null,
          price_year: 2025,
          price_month: 12,
          purpose: "official_pension",
          liquid: false,
        },
        {
          ...missingPosition,
          instrument_id: 71,
          instrument_name: "Yuxi",
          broker_name: "Protección",
          purpose: "emergency",
          liquid: true,
        },
      ],
    },
    cdts: {
      total: "1100",
      positions: [
        {
          ...copPosition,
          instrument_id: 92,
          instrument_name: "Plazo",
          broker_id: 90,
          broker_name: "Bancolombia",
          balance: "1000",
          last_price: null,
          price_year: 2026,
          price_month: 1,
          value: "1100",
          annual_rate: "10",
          opened_on: "2025-01-01",
          matures_on: "2026-01-01",
          term_days: 365,
          yield_payment: "at_maturity" as const,
          payment_frequency: "single" as const,
          capitalize: true,
          gross_yield: "186405",
          net_yield: "178949",
          withholding: "7456",
          status: "matured" as const,
          liquid: true,
        },
        {
          ...missingPosition,
          instrument_id: 93,
          instrument_name: "Futuro",
          broker_name: "Davivienda",
          balance: "200",
          annual_rate: "5",
          opened_on: "2026-08-01",
          matures_on: "2027-08-01",
          term_days: 365,
          yield_payment: "in_advance" as const,
          payment_frequency: "monthly" as const,
          capitalize: false,
          gross_yield: "0",
          net_yield: "0",
          withholding: "0",
          status: "upcoming" as const,
          liquid: false,
        },
      ],
    },
  });
  api.institutions.mockResolvedValue([institution, otherInstitution]);
  api.reserveAccounts.mockResolvedValue([ceiba, apnea]);
  api.reserveBalances.mockResolvedValue([]);
  api.createInstitution.mockResolvedValue(institution);
  api.patchInstitution.mockResolvedValue(institution);
  api.deleteInstitution.mockResolvedValue(undefined);
  api.createReserveAccount.mockResolvedValue(ceiba);
  api.patchReserveAccount.mockResolvedValue(ceiba);
  api.deleteReserveAccount.mockResolvedValue(undefined);
  api.upsertReserveBalance.mockResolvedValue({ id: 9 });
  api.banks.mockResolvedValue([
    { id: 90, name: "Bancolombia" },
    { id: 91, name: "Davivienda" },
  ]);
  api.cdts.mockResolvedValue([
    {
      id: 92,
      name: "Plazo",
      bank_id: 90,
      bank_name: "Bancolombia",
      currency: "COP" as const,
      principal: "1000",
      annual_rate: "10",
      opened_on: "2025-01-01",
      matures_on: "2026-01-01",
      term_days: 365,
      yield_payment: "at_maturity" as const,
      payment_frequency: "single" as const,
      capitalize: true,
      gross_yield: "186405",
      net_yield: "178949",
      withholding: "7456",
      active: true,
      value: "1100",
      status: "matured" as const,
      liquid: true,
    },
    {
      id: 93,
      name: "Futuro",
      bank_id: 91,
      bank_name: "Davivienda",
      currency: "COP" as const,
      principal: "200",
      annual_rate: "5",
      opened_on: "2026-08-01",
      matures_on: "2027-08-01",
      term_days: 365,
      yield_payment: "in_advance" as const,
      payment_frequency: "monthly" as const,
      capitalize: false,
      gross_yield: "0",
      net_yield: "0",
      withholding: "0",
      active: false,
      value: null,
      status: "upcoming" as const,
      liquid: false,
    },
  ]);
  api.createBank.mockResolvedValue({ id: 90, name: "Bancolombia" });
  api.patchBank.mockResolvedValue({ id: 90, name: "Bancolombia" });
  api.deleteBank.mockResolvedValue(undefined);
  api.createCdt.mockResolvedValue({ id: 92, name: "Plazo" });
  api.patchCdt.mockResolvedValue({ id: 92, name: "Plazo" });
  api.deleteCdt.mockResolvedValue(undefined);
  api.funds.mockResolvedValue([fund, { ...fund, id: 6, name: "FIC Off", active: false }]);
  api.fiduciaries.mockResolvedValue([fiduciary]);
  api.fundTrades.mockResolvedValue([
    {
      id: 31,
      fund_id: 4,
      fiduciary_id: 5,
      type: "subscribe",
      year: 2024,
      month: 2,
      quantity: "5",
      commission: "1",
      price: "10",
      fund_name: "FIC Uno",
      fiduciary_name: "Fid Uno",
      fund_currency: "COP",
    },
    {
      id: 32,
      fund_id: 4,
      fiduciary_id: 5,
      type: "redeem",
      year: 2025,
      month: null,
      quantity: "1",
      commission: "0",
      price: null,
      fund_name: "FIC Uno",
      fiduciary_name: "Fid Uno",
      fund_currency: "USD",
    },
  ]);
  api.fundUnitValues.mockResolvedValue([
    { id: 41, fund_id: 4, year: 2026, month: 1, value: "10.5", fund_name: "FIC Uno", fund_currency: "COP" },
  ]);
  api.variation.mockResolvedValue(variation);
  api.fundVariation.mockResolvedValue({
    fund_id: 4,
    fund_name: "FIC Uno",
    fund_currency: "COP",
    points: variation.points,
  });
  api.targetProgress.mockResolvedValue(progress);
  api.fundTargetProgress.mockResolvedValue({
    fund_id: 4,
    fund_name: "FIC Uno",
    last_price: "10",
    price_year: 2026,
    price_month: 9,
    target: "12",
    target_year: 2026,
    target_month: 9,
    progress_pct: "80",
    fund_currency: "COP",
  });
  api.targets.mockResolvedValue([target]);
  api.fundTargets.mockResolvedValue([
    { id: 8, fund_id: 4, year: 2026, month: 9, price: "12", fund_name: "FIC Uno", fund_currency: "COP" },
  ]);
  api.createInstrument.mockResolvedValue(eco);
  api.createBroker.mockResolvedValue(broker);
  api.patchInstrument.mockResolvedValue(eco);
  api.patchBroker.mockResolvedValue(broker);
  api.createTrade.mockResolvedValue({});
  api.updateTrade.mockResolvedValue({});
  api.deleteTrade.mockResolvedValue(undefined);
  api.upsertPrice.mockResolvedValue({});
  api.createFund.mockResolvedValue(fund);
  api.createFiduciary.mockResolvedValue(fiduciary);
  api.patchFund.mockResolvedValue(fund);
  api.patchFiduciary.mockResolvedValue(fiduciary);
  api.createFundTrade.mockResolvedValue({});
  api.updateFundTrade.mockResolvedValue({});
  api.deleteFundTrade.mockResolvedValue(undefined);
  api.upsertFundUnitValue.mockResolvedValue({});
  api.upsertTarget.mockResolvedValue(target);
  api.upsertFundTarget.mockResolvedValue({});
  api.importOfficialFx.mockResolvedValue([{ id: 1, year: 2026, month: 1, cop_per_usd: "4000" }]);
  api.upsertFxRate.mockResolvedValue({});
});

describe("theme and currency", () => {
  it("reads, applies and stores the theme", async () => {
    const user = userEvent.setup();
    localStorage.setItem("acciones.theme", "light");
    expect(readTheme()).toBe("light");
    localStorage.setItem("stocks.theme", "dark");
    expect(readTheme()).toBe("dark");
    localStorage.setItem("stocks.theme", "nope");
    expect(readTheme()).toBe("dark");
    window.matchMedia = () => ({ matches: true, media: "", addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
    localStorage.clear();
    expect(readTheme()).toBe("light");

    document.head.innerHTML = '<meta name="theme-color" content="">';
    applyTheme("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#0B1120");
    applyTheme("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#F8FAFC");
    document.head.innerHTML = "";
    applyTheme("dark");
    expect(chartTheme("dark").label).toBe("#F8FAFC");
    expect(chartTheme("light").label).toBe("#0F172A");
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList;

    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
    shell(<ThemeButton />);
    await user.click(screen.getByRole("button", { name: "tema" }));
    expect(localStorage.getItem("stocks.theme")).toBe("light");
  });

  it("stores the display currency and refreshes rates", async () => {
    const user = userEvent.setup();
    localStorage.setItem("acciones.currency", "USD");
    function Probe() {
      const { currency, setCurrency, refreshRates, rates } = useCurrency();
      return (
        <button type="button" onClick={() => { setCurrency(currency === "USD" ? "COP" : "USD"); refreshRates(); }}>
          {currency}:{rates.length}
        </button>
      );
    }
    shell(<Probe />);
    await waitFor(() => expect(api.fxRates).toHaveBeenCalled());
    await user.click(screen.getByRole("button"));
    expect(localStorage.getItem("stocks.currency")).toBe("COP");
    api.fxRates.mockRejectedValueOnce(new Error("red"));
    await user.click(screen.getByRole("button"));
    expect(() => renderHook(() => useCurrency())).toThrow(/CurrencyProvider/);
  });
});

describe("banner", () => {
  it("shows one or many missing prices and hides an empty month", async () => {
    api.pendingPrices.mockResolvedValueOnce({
      year: 2026, month: 1, total_active: 1, pending: 1,
      missing: [{ instrument_id: 1, instrument_name: "Ecopetrol" }],
    });
    const view = shell(<BannerPrecios linkToPrices kind="both" />);
    expect(await screen.findByRole("link", { name: "Cargar en Precios" })).toBeInTheDocument();
    view.unmount();

    api.pendingPrices.mockResolvedValueOnce({ year: 2026, month: 1, total_active: 1, pending: 0, missing: [] });
    api.pendingFundUnitValues.mockResolvedValueOnce({ year: 2026, month: 1, total_active: 1, pending: 0, missing: [] });
    shell(<BannerPrecios kind="both" />);
    await waitFor(() => expect(api.pendingPrices).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows fund gaps and ignores a failed request", async () => {
    api.pendingFundUnitValues.mockResolvedValueOnce({
      year: 2026, month: 1, total_active: 1, pending: 1,
      missing: [{ fund_id: 4, fund_name: "FIC Uno" }],
    });
    const view = shell(<BannerPrecios linkToPrices kind="funds" />);
    expect(await screen.findByRole("link", { name: "Cargar en Fondos" })).toBeInTheDocument();
    view.unmount();
    api.pendingPrices.mockRejectedValueOnce(new Error("no"));
    shell(<BannerPrecios kind="equities" />);
    await waitFor(() => expect(api.pendingPrices).toHaveBeenCalled());
    api.pendingFundUnitValues.mockRejectedValueOnce(new Error("no"));
    shell(<BannerPrecios kind="funds" />);
    await waitFor(() => expect(api.pendingFundUnitValues).toHaveBeenCalled());
  });
});

describe("catalogs", () => {
  it("adds, renames and toggles holdings and brokers", async () => {
    const user = userEvent.setup();
    shell(<Catalog />);
    expect(await screen.findByText("Ecopetrol")).toBeInTheDocument();
    expect(screen.getByText("ETB")).toBeInTheDocument();

    const names = screen.getAllByPlaceholderText("Nombre");
    await user.type(names[0], "Nuevo");
    await user.selectOptions(screen.getByLabelText("Moneda del título"), "USD");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    await waitFor(() => expect(api.createInstrument).toHaveBeenCalledWith("Nuevo", "USD"));

    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "Casa");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    await waitFor(() => expect(api.createBroker).toHaveBeenCalledWith("Casa"));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(api.patchInstrument).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const draft = screen.getByLabelText("Nombre");
    await user.clear(draft);
    fireEvent.submit(draft.closest("form")!);
    expect(api.patchInstrument).not.toHaveBeenCalled();
    await user.type(draft, "Eco SA");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchInstrument).toHaveBeenCalledWith(1, { name: "Eco SA" }));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const brokerDraft = screen.getByLabelText("Nombre");
    await user.clear(brokerDraft);
    await user.type(brokerDraft, "Trii Plus");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchBroker).toHaveBeenCalledWith(3, "Trii Plus"));

    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    await waitFor(() => expect(api.patchInstrument).toHaveBeenCalledWith(1, { active: false }));
    await user.click(screen.getByRole("button", { name: "Activar" }));

    api.createInstrument.mockRejectedValueOnce("x");
    await user.type(screen.getAllByPlaceholderText("Nombre")[0], "Z");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.createInstrument.mockRejectedValueOnce(new Error("duplicado"));
    await user.type(screen.getAllByPlaceholderText("Nombre")[0], "X");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("duplicado")).toBeInTheDocument();
    api.createBroker.mockRejectedValueOnce(new Error("casa"));
    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "Z");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("casa")).toBeInTheDocument();
    api.createBroker.mockRejectedValueOnce("roto");
    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "Y");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("Error")).toBeInTheDocument();

    api.patchInstrument.mockRejectedValueOnce(new Error("no toggle"));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("no toggle")).toBeInTheDocument();
    api.patchInstrument.mockRejectedValueOnce("x");
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();

    api.patchInstrument.mockRejectedValueOnce(new Error("nombre"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const renamed = screen.getByLabelText("Nombre");
    await user.clear(renamed);
    await user.type(renamed, "Otro");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("nombre")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    api.patchBroker.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const brokerAgain = screen.getByLabelText("Nombre");
    await user.clear(brokerAgain);
    await user.type(brokerAgain, "Otra casa");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    api.instruments.mockRejectedValueOnce(new Error("sin catalogo"));
    shell(<Catalog />);
    expect(await screen.findByText("sin catalogo")).toBeInTheDocument();
  });

  it("adds, renames and toggles funds", async () => {
    const user = userEvent.setup();
    api.funds.mockRejectedValueOnce(new Error("sin fondos"));
    const failed = shell(<FundsCatalog />);
    expect(await screen.findByText("sin fondos")).toBeInTheDocument();
    failed.unmount();
    shell(<FundsCatalog />);
    expect(await screen.findByText("FIC Uno")).toBeInTheDocument();
    const names = screen.getAllByPlaceholderText("Nombre");
    await user.type(names[0], "Nuevo FIC");
    await user.selectOptions(screen.getByLabelText("Moneda del fondo"), "USD");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    await waitFor(() => expect(api.createFund).toHaveBeenCalledWith("Nuevo FIC", "USD"));
    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "Nueva Fid");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    await waitFor(() => expect(api.createFiduciary).toHaveBeenCalledWith("Nueva Fid"));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const draft = screen.getByLabelText("Nombre");
    await user.clear(draft);
    fireEvent.submit(draft.closest("form")!);
    await user.type(draft, "FIC Dos");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchFund).toHaveBeenCalledWith(4, { name: "FIC Dos" }));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const fidDraft = screen.getByLabelText("Nombre");
    await user.clear(fidDraft);
    await user.type(fidDraft, "Fid Dos");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchFiduciary).toHaveBeenCalledWith(5, "Fid Dos"));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    api.createFund.mockRejectedValueOnce(new Error("fondo"));
    await user.type(screen.getAllByPlaceholderText("Nombre")[0], "Z");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("fondo")).toBeInTheDocument();
    api.patchFiduciary.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const again = screen.getByLabelText("Nombre");
    await user.clear(again);
    await user.type(again, "Otra");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();

    api.createFund.mockRejectedValueOnce("x");
    await user.type(screen.getAllByPlaceholderText("Nombre")[0], "Q");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.createFiduciary.mockRejectedValueOnce(new Error("fid"));
    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "Q");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("fid")).toBeInTheDocument();
    api.createFiduciary.mockRejectedValueOnce("x");
    await user.type(screen.getAllByPlaceholderText("Nombre")[1], "W");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.patchFund.mockRejectedValueOnce(new Error("no toggle"));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("no toggle")).toBeInTheDocument();
    api.patchFund.mockRejectedValueOnce("x");
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.patchFund.mockRejectedValueOnce(new Error("nombre"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const fundAgain = screen.getByLabelText("Nombre");
    await user.clear(fundAgain);
    await user.type(fundAgain, "FIC Tres");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("nombre")).toBeInTheDocument();
  });
});

describe("prices and fx", () => {
  it("saves a price grid and skips a blank cell", async () => {
    const user = userEvent.setup();
    api.prices.mockRejectedValueOnce(new Error("no precios"));
    const failed = shell(<Prices />);
    expect(await screen.findByText("no precios")).toBeInTheDocument();
    failed.unmount();

    shell(<Prices />);
    await screen.findByText("Ecopetrol");
    const cells = screen.getAllByRole("textbox");
    fireEvent.change(cells[0], { target: { value: "   " } });
    fireEvent.change(cells[1], { target: { value: "12.5" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.upsertPrice).toHaveBeenCalled());
    api.upsertPrice.mockRejectedValueOnce(new Error("malo"));
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "1" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("malo")).toBeInTheDocument();
    api.upsertPrice.mockRejectedValueOnce("x");
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    setInput(screen.getByRole("spinbutton"), "2020");
  });

  it("saves unit values", async () => {
    const user = userEvent.setup();
    shell(<FundsPrices />);
    await screen.findByText("FIC Uno");
    setInput(screen.getAllByRole("textbox")[0], "   ");
    api.upsertFundUnitValue.mockRejectedValueOnce(new Error("valor"));
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("valor")).toBeInTheDocument();
    api.upsertFundUnitValue.mockRejectedValueOnce("x");
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "9" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "9" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.upsertFundUnitValue).toHaveBeenCalled());
    api.fundUnitValues.mockRejectedValueOnce(new Error("sin valores"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2030" } });
    expect(await screen.findByText("sin valores")).toBeInTheDocument();
  });

  it("saves a typed rate and fetches the official series", async () => {
    const user = userEvent.setup();
    api.fxRates.mockRejectedValueOnce(new Error("sin trm"));
    const failed = shell(<FxRates />);
    expect(await screen.findByText("sin trm")).toBeInTheDocument();
    failed.unmount();
    api.fxRates.mockResolvedValue([{ id: 1, year: 2026, month: 1, cop_per_usd: "4100" }]);
    shell(<FxRates />);
    await screen.findByDisplayValue("4100");
    const cells = screen.getAllByRole("textbox");
    fireEvent.change(cells[1], { target: { value: " " } });
    fireEvent.change(cells[2], { target: { value: "4200" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.upsertFxRate).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Traer TRM oficial" }));
    await waitFor(() => expect(api.importOfficialFx).toHaveBeenCalled());
    api.importOfficialFx.mockRejectedValueOnce(new Error("fuente"));
    await user.click(screen.getByRole("button", { name: "Traer TRM oficial" }));
    expect(await screen.findByText("fuente")).toBeInTheDocument();
    api.importOfficialFx.mockRejectedValueOnce("x");
    await user.click(screen.getByRole("button", { name: "Traer TRM oficial" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.upsertFxRate.mockRejectedValueOnce(new Error("tasa"));
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "1" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("tasa")).toBeInTheDocument();
    api.upsertFxRate.mockRejectedValueOnce("x");
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    setInput(screen.getByRole("spinbutton"), "2019");
  });
});

describe("trades", () => {
  it("creates, edits and deletes a trade", async () => {
    const user = userEvent.setup();
    api.trades.mockRejectedValueOnce(new Error("movimientos"));
    const failed = shell(<Trades />);
    expect(await screen.findByText("movimientos")).toBeInTheDocument();
    failed.unmount();
    window.confirm = vi.fn(() => false);
    shell(<Trades />);
    expect(await screen.findByText("Ecopetrol")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Título"), "1");
    await user.selectOptions(screen.getByLabelText("Corredor"), "3");
    await user.selectOptions(screen.getByLabelText("Tipo"), "sell");
    setInput(screen.getByLabelText("Mes (opcional)"), "4");
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Precio por acción/), { target: { value: "50" } });
    setInput(screen.getByLabelText(/Comisión/), "9");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.createTrade).toHaveBeenCalled());
    expect(api.createTrade.mock.calls[0][0].commission).toBe("9");

    setInput(screen.getByLabelText("Año"), "2024");
    api.createTrade.mockRejectedValueOnce(new Error("compra"));
    await user.selectOptions(screen.getByLabelText("Título"), "1");
    await user.selectOptions(screen.getByLabelText("Corredor"), "3");
    setInput(screen.getByLabelText("Cantidad"), "1");
    setInput(screen.getByLabelText(/Precio por acción/), "1");
    setInput(screen.getByLabelText(/Comisión/), "9");
    setInput(screen.getByLabelText(/Comisión/), "");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(api.createTrade.mock.calls[1][0].commission).toBe("0");
    expect(await screen.findByText("compra")).toBeInTheDocument();
    api.createTrade.mockRejectedValueOnce("x");
    await user.selectOptions(screen.getByLabelText("Título"), "2");
    await user.selectOptions(screen.getByLabelText("Corredor"), "3");
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Precio por acción/), { target: { value: "1" } });
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(api.deleteTrade).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    setInput(screen.getByLabelText(/Precio por acción/), "");
    setInput(screen.getByLabelText("Mes (opcional)"), "");
    setInput(screen.getByLabelText(/Comisión/), "");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.updateTrade).toHaveBeenCalled());
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    await waitFor(() => expect(api.deleteTrade).toHaveBeenCalledWith(11));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    await waitFor(() => expect(api.deleteTrade).toHaveBeenCalledWith(11));
    api.deleteTrade.mockRejectedValueOnce(new Error("no borra"));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(await screen.findByText("no borra")).toBeInTheDocument();
    api.deleteTrade.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
  });

  it("creates, edits and deletes a fund trade", async () => {
    const user = userEvent.setup();
    api.fundTrades.mockRejectedValueOnce(new Error("movimientos"));
    const failed = shell(<FundsTrades />);
    expect(await screen.findByText("movimientos")).toBeInTheDocument();
    failed.unmount();
    window.confirm = vi.fn(() => false);
    shell(<FundsTrades />);
    expect((await screen.findAllByText("FIC Uno")).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(api.deleteFundTrade).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.selectOptions(screen.getByLabelText("Fondo"), "4");
    await user.selectOptions(screen.getByLabelText("Fiduciaria"), "5");
    await user.selectOptions(screen.getByLabelText("Tipo"), "redeem");
    setInput(screen.getByLabelText("Año"), "2024");
    setInput(screen.getByLabelText("Mes (opcional)"), "4");
    setInput(screen.getByLabelText("Unidades"), "1");
    setInput(screen.getByLabelText(/Valor de unidad/), "8");
    setInput(screen.getByLabelText(/Comisión/), "");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.createFundTrade).toHaveBeenCalled());
    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    setInput(screen.getByLabelText(/Valor de unidad/), "");
    setInput(screen.getByLabelText("Mes (opcional)"), "");
    setInput(screen.getByLabelText(/Comisión/), "");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.updateFundTrade).toHaveBeenCalled());
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[1]);
    await waitFor(() => expect(api.deleteFundTrade).toHaveBeenCalledWith(32));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    await waitFor(() => expect(api.deleteFundTrade).toHaveBeenCalledWith(31));
    api.deleteFundTrade.mockRejectedValueOnce(new Error("no borra"));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(await screen.findByText("no borra")).toBeInTheDocument();
    api.deleteFundTrade.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.createFundTrade.mockRejectedValueOnce(new Error("rescate"));
    await user.selectOptions(screen.getByLabelText("Fondo"), "4");
    await user.selectOptions(screen.getByLabelText("Fiduciaria"), "5");
    setInput(screen.getByLabelText("Unidades"), "1");
    setInput(screen.getByLabelText(/Valor de unidad/), "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("rescate")).toBeInTheDocument();
    api.createFundTrade.mockRejectedValueOnce("x");
    await user.selectOptions(screen.getByLabelText("Fondo"), "4");
    await user.selectOptions(screen.getByLabelText("Fiduciaria"), "5");
    setInput(screen.getByLabelText("Unidades"), "1");
    setInput(screen.getByLabelText(/Valor de unidad/), "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
  });
});

describe("summary block", () => {
  const labels = {
    positions: "Posiciones",
    instrument: "Título",
    broker: "Corredor",
    lastPrice: "Precio",
    noPrice: "Sin precio",
    pieTitle: "Peso",
    pieEmpty: "Sin peso",
    variationTitle: "Variación",
    variationEmpty: "Sin variación",
    targetTitle: "Objetivo",
    targetPrice: "Precio objetivo",
    saveTarget: "Guardar objetivo",
    targetEmpty: "Sin objetivo",
    targetVs: "Contra el objetivo",
  };

  it("renders values, a missing rate and a progress bar", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    shell(
      <PortfolioBlock
        title="Acciones"
        labels={labels}
        positions={[copPosition, usdPosition, missingPosition, { ...copPosition, instrument_id: 8, value: "0", last_price: "0" }]}
        items={[eco, dormant]}
        selectedId={1}
        onSelect={onSelect}
        variation={variation}
        progress={progress}
        targets={[target, { ...target, id: 9, instrument_currency: "USD" }]}
        objYear="2026"
        objMonth="9"
        objPrice=""
        onObjYear={vi.fn()}
        onObjMonth={vi.fn()}
        onObjPrice={vi.fn()}
        onSaveTarget={vi.fn()}
      />,
    );
    expect(await screen.findByText("Acciones")).toBeInTheDocument();
    await user.selectOptions(screen.getAllByRole("combobox")[0], "1");
    await user.selectOptions(screen.getAllByRole("combobox")[1], "1");
    expect(onSelect).toHaveBeenCalled();
    setInput(screen.getByLabelText("Año"), "2025");
    setInput(screen.getByLabelText("Mes"), "8");
    setInput(screen.getByLabelText(labels.targetPrice), "70");
  });

  it("shows the empty states", () => {
    shell(
      <PortfolioBlock
        title="Vacío"
        labels={labels}
        positions={[]}
        items={[]}
        selectedId=""
        onSelect={vi.fn()}
        variation={null}
        progress={null}
        targets={[]}
        objYear="2026"
        objMonth="9"
        objPrice=""
        onObjYear={vi.fn()}
        onObjMonth={vi.fn()}
        onObjPrice={vi.fn()}
        onSaveTarget={vi.fn()}
      />,
    );
    expect(screen.getByText("Sin peso")).toBeInTheDocument();
    expect(screen.getByText("Sin variación")).toBeInTheDocument();
    expect(screen.getByText("Sin objetivo")).toBeInTheDocument();
    fireEvent.submit(screen.getByText("Guardar objetivo").closest("form")!);
  });

  it("saves both targets from the summary", async () => {
    const user = userEvent.setup();
    shell(<Summary />);
    expect((await screen.findAllByText("Ecopetrol")).length).toBeGreaterThan(0);
    const prices = screen.getAllByLabelText(/Precio objetivo|Valor objetivo/);
    fireEvent.change(prices[0], { target: { value: "90" } });
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[0]);
    await waitFor(() => expect(api.upsertTarget).toHaveBeenCalled());
    fireEvent.change(screen.getAllByLabelText(/Precio objetivo|Valor objetivo/)[1], { target: { value: "15" } });
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[1]);
    await waitFor(() => expect(api.upsertFundTarget).toHaveBeenCalled());
    api.variation.mockRejectedValueOnce(new Error("var"));
    api.fundVariation.mockRejectedValueOnce(new Error("var fondo"));
    setInput(screen.getAllByLabelText("Año")[0], "2025");
    setInput(screen.getAllByLabelText("Mes")[0], "8");
    setInput(screen.getAllByLabelText("Año")[1], "2024");
    setInput(screen.getAllByLabelText("Mes")[1], "3");
    api.upsertTarget.mockRejectedValueOnce(new Error("objetivo"));
    fireEvent.change(screen.getAllByLabelText(/Precio objetivo|Valor objetivo/)[0], { target: { value: "1" } });
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[0]);
    expect(await screen.findByText("objetivo")).toBeInTheDocument();
    api.upsertTarget.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.upsertFundTarget.mockRejectedValueOnce(new Error("objetivo fondo"));
    setInput(screen.getAllByLabelText(/Precio objetivo|Valor objetivo/)[1], "4");
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[1]);
    expect(await screen.findByText("objetivo fondo")).toBeInTheDocument();
    api.upsertFundTarget.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: /Guardar objetivo/ })[1]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    const broken = shell(<Summary />);
    expect(await screen.findByText(/var/)).toBeInTheDocument();
    broken.unmount();
  });

  it("leaves the selectors empty when nothing is active", async () => {
    api.instruments.mockResolvedValue([]);
    api.funds.mockResolvedValue([]);
    api.wealth.mockResolvedValue({
      total: "0",
      equities: { total: "0", positions: [] },
      funds: { total: "0", positions: [] },
      reserves: { total: "0", positions: [] },
      cdts: { total: "0", positions: [] },
    });
    shell(<Summary />);
    await waitFor(() => expect(api.wealth).toHaveBeenCalled());
    fireEvent.submit(screen.getAllByRole("button", { name: /Guardar objetivo/ })[0].closest("form")!);
    fireEvent.submit(screen.getAllByRole("button", { name: /Guardar objetivo/ })[1].closest("form")!);
    api.wealth.mockRejectedValueOnce(new Error("carga"));
    shell(<Summary />);
    expect(await screen.findByText("carga")).toBeInTheDocument();
  });
});

describe("app shell", () => {
  it("switches module, theme, currency and language", async () => {
    const user = userEvent.setup();
    shell(<App />, "/prices");
    await screen.findByRole("button", { name: "Guardar cambios" });
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await user.click(screen.getByRole("link", { name: "Precios" }));
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await user.click(screen.getByRole("link", { name: "Movimientos" }));
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await user.click(screen.getByRole("link", { name: "Catálogo" }));
    await user.click(screen.getByRole("link", { name: "TRM" }));
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await user.selectOptions(screen.getByLabelText("Tema"), "light");
    await user.selectOptions(screen.getByLabelText("Moneda"), "USD");
    await user.selectOptions(screen.getByLabelText("Idioma"), "en");
    await user.click(screen.getByRole("link", { name: "Summary" }));
    await i18n.changeLanguage("de");
    expect((screen.getByLabelText("Idioma") as HTMLSelectElement).value).toBe("es");
  });

  it("switches between the paired equity and fund pages", async () => {
    const user = userEvent.setup();
    const trades = shell(<App />, "/trades");
    await screen.findByLabelText("Título");
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await screen.findByLabelText("Fondo");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await screen.findByLabelText("Título");
    trades.unmount();

    const catalog = shell(<App />, "/catalog");
    await screen.findByText("Ecopetrol");
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await screen.findByText("FIC Uno");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await screen.findByText("Ecopetrol");
    catalog.unmount();

    expect(counterpart("/", "funds")).toBe("/funds");
    expect(counterpart("/catalog", "funds")).toBe("/funds/catalog");
    expect(counterpart("/fx", "funds")).toBe("/fx");
    expect(counterpart("/funds", "equities")).toBe("/");
    expect(counterpart("/fx", "equities")).toBe("/fx");
    expect(counterpart("/", "equities")).toBe("/");
    expect(counterpart("/", "reserves")).toBe("/reserves");
    expect(counterpart("/prices", "reserves")).toBe("/reserves/balances");
    expect(counterpart("/reserves/balances", "equities")).toBe("/prices");
    expect(counterpart("/reserves/balances", "funds")).toBe("/funds/prices");
    expect(counterpart("/reserves/catalog", "equities")).toBe("/catalog");
    expect(counterpart("/reserves", "funds")).toBe("/funds");
    expect(counterpart("/", "cdts")).toBe("/cdts");
    expect(counterpart("/prices", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/trades", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/catalog", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/funds", "cdts")).toBe("/cdts");
    expect(counterpart("/funds/prices", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/funds/trades", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/funds/catalog", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/reserves", "cdts")).toBe("/cdts");
    expect(counterpart("/reserves/balances", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/reserves/catalog", "cdts")).toBe("/cdts/catalog");
    expect(counterpart("/cdts", "equities")).toBe("/");
    expect(counterpart("/cdts", "funds")).toBe("/funds");
    expect(counterpart("/cdts", "reserves")).toBe("/reserves");
    expect(counterpart("/cdts/catalog", "equities")).toBe("/catalog");
    expect(counterpart("/cdts/catalog", "funds")).toBe("/funds/catalog");
    expect(counterpart("/cdts/catalog", "reserves")).toBe("/reserves/catalog");
    expect(counterpart("/fx", "cdts")).toBe("/fx");
    shell(<App />, "/funds");
    await screen.findByText("Total combinado (acciones + fondos + reservas + CDTs)");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await screen.findByText("Total combinado (acciones + fondos + reservas + CDTs)");
  });

  it("redirects the old Spanish paths", async () => {
    shell(<App />, "/precios");
    await waitFor(() => expect(api.prices).toHaveBeenCalled());
    shell(<App />, "/movimientos");
    await waitFor(() => expect(api.trades).toHaveBeenCalled());
    shell(<App />, "/catalogo");
    await waitFor(() => expect(api.instruments).toHaveBeenCalled());
    shell(<App />, "/funds");
    await waitFor(() => expect(api.wealth).toHaveBeenCalled());
    shell(<App />, "/reserves");
    expect(await screen.findByRole("link", { name: "Saldos" })).toBeInTheDocument();
  });
});

describe("reserves", () => {
  it("shows the reserve row on the summary", async () => {
    shell(<Summary />);
    expect(await screen.findByText("Ceiba")).toBeInTheDocument();
    expect(screen.getByText("Pensión oficial")).toBeInTheDocument();
    expect(screen.getByText("No líquida")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("Dic")).toBeInTheDocument();
    expect(screen.getByText("Yuxi")).toBeInTheDocument();
    expect(screen.getByText("Líquida")).toBeInTheDocument();
    expect(screen.getByText("sin saldo")).toBeInTheDocument();
  });

  it("adds, renames and deletes reserve catalog rows", async () => {
    const user = userEvent.setup();
    api.institutions.mockRejectedValueOnce(new Error("sin reservas"));
    const failed = shell(<ReservesCatalog />);
    expect(await screen.findByText("sin reservas")).toBeInTheDocument();
    failed.unmount();

    shell(<ReservesCatalog />);
    expect((await screen.findAllByText("Protección")).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Instituciones"), "Nueva");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    await waitFor(() => expect(api.createInstitution).toHaveBeenCalledWith("Nueva"));

    await user.type(screen.getByLabelText("Cuentas"), "MAS");
    await user.selectOptions(screen.getByLabelText("Institución"), "81");
    await user.selectOptions(screen.getByLabelText("Moneda de la cuenta"), "USD");
    await user.selectOptions(screen.getByLabelText("Propósito"), "emergency");
    expect(screen.getByRole("checkbox", { name: "Líquida" })).toBeChecked();
    await user.selectOptions(screen.getByLabelText("Propósito"), "severance");
    expect(screen.getByRole("checkbox", { name: "Líquida" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Líquida" }));
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    await waitFor(() =>
      expect(api.createReserveAccount).toHaveBeenCalledWith({
        name: "MAS",
        institution_id: 81,
        currency: "USD",
        purpose: "severance",
        liquid: true,
      }),
    );

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const same = screen.getByLabelText("Nombre");
    await user.clear(same);
    fireEvent.submit(same.closest("form")!);
    await user.type(same, "Protección SA");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchInstitution).toHaveBeenCalledWith(80, "Protección SA"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const accountDraft = screen.getByLabelText("Nombre");
    await user.clear(accountDraft);
    await user.type(accountDraft, "Plan Ceiba");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchReserveAccount).toHaveBeenCalledWith(70, { name: "Plan Ceiba" }));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    await waitFor(() => expect(api.patchReserveAccount).toHaveBeenCalledWith(70, { active: false }));
    await user.click(screen.getByRole("button", { name: "Marcar líquida" }));
    await waitFor(() => expect(api.patchReserveAccount).toHaveBeenCalledWith(70, { liquid: true }));

    window.confirm = vi.fn(() => false);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(api.deleteInstitution).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    await waitFor(() => expect(api.deleteInstitution).toHaveBeenCalledWith(80));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[2]);
    await waitFor(() => expect(api.deleteReserveAccount).toHaveBeenCalledWith(70));

    api.createInstitution.mockRejectedValueOnce(new Error("inst"));
    await user.type(screen.getByLabelText("Instituciones"), "Z");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("inst")).toBeInTheDocument();
    api.createInstitution.mockRejectedValueOnce("x");
    await user.type(screen.getByLabelText("Instituciones"), "Y");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.createReserveAccount.mockRejectedValueOnce(new Error("cuenta"));
    await user.type(screen.getByLabelText("Cuentas"), "Q");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("cuenta")).toBeInTheDocument();
    api.patchReserveAccount.mockRejectedValueOnce(new Error("no toggle"));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("no toggle")).toBeInTheDocument();
    api.patchReserveAccount.mockRejectedValueOnce("x");
    await user.click(screen.getByRole("button", { name: "Marcar líquida" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.patchInstitution.mockRejectedValueOnce(new Error("nombre"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const again = screen.getByLabelText("Nombre");
    await user.clear(again);
    await user.type(again, "Otra casa");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("nombre")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    api.deleteReserveAccount.mockRejectedValueOnce(new Error("no borra"));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[2]);
    expect(await screen.findByText("no borra")).toBeInTheDocument();
  });

  it("saves one month and leaves the blank cells", async () => {
    const user = userEvent.setup();
    api.reserveAccounts.mockRejectedValueOnce(new Error("sin saldos"));
    const failed = shell(<ReserveBalances />);
    expect(await screen.findByText("sin saldos")).toBeInTheDocument();
    failed.unmount();

    api.reserveBalances.mockImplementation(async (year: number) => {
      if (year !== 2024) return [];
      return [
        {
          id: 9,
          account_id: 70,
          year: 2024,
          month: 1,
          balance: "100",
          account_name: "Ceiba",
          institution_name: "Protección",
          currency: "COP" as const,
          purpose: "official_pension" as const,
          liquid: false,
        },
      ];
    });
    shell(<ReserveBalances />);
    expect(await screen.findByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    setInput(screen.getByLabelText("Año"), "2024");
    expect(await screen.findByDisplayValue("100")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ceiba Ene"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Ceiba Feb"), { target: { value: "260" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(api.upsertReserveBalance).toHaveBeenCalledWith({
        account_id: 70,
        year: 2024,
        month: 2,
        balance: "260",
      }),
    );
    expect(api.upsertReserveBalance).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Saldos guardados")).toBeInTheDocument();
    api.upsertReserveBalance.mockRejectedValueOnce(new Error("saldo"));
    fireEvent.change(screen.getByLabelText("Ceiba Feb"), { target: { value: "1" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("saldo")).toBeInTheDocument();
    api.upsertReserveBalance.mockRejectedValueOnce("x");
    fireEvent.change(screen.getByLabelText("Ceiba Feb"), { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.reserveBalances.mockRejectedValueOnce(new Error("año"));
    setInput(screen.getByLabelText("Año"), "2023");
    expect(await screen.findByText("año")).toBeInTheDocument();
    const now = new Date();
    api.reserveBalances.mockImplementation(async (selected: number) => {
      if (selected !== now.getFullYear()) return [];
      return [
        {
          id: 10,
          account_id: 70,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          balance: "5",
          account_name: "Ceiba",
          institution_name: "Protección",
          currency: "COP" as const,
          purpose: "official_pension" as const,
          liquid: false,
        },
      ];
    });
    setInput(screen.getByLabelText("Año"), String(now.getFullYear()));
    expect(await screen.findByDisplayValue("5")).toBeInTheDocument();
  });

  it("switches into the reserve module", async () => {
    const user = userEvent.setup();
    const prices = shell(<App />, "/prices");
    await screen.findByRole("button", { name: "Guardar cambios" });
    await user.selectOptions(screen.getByLabelText("Módulo"), "reserves");
    await screen.findByText("Ceiba");
    await user.click(screen.getByRole("link", { name: "Catálogo" }));
    await screen.findByText("Instituciones");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await screen.findByText("Ecopetrol");
    prices.unmount();

    shell(<App />, "/reserves/catalog");
    await screen.findByText("Ceiba");
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await screen.findByText("FIC Uno");
  });
});

describe("cdts", () => {
  it("shows the cdt row on the summary", async () => {
    shell(<Summary />);
    expect(await screen.findByText("Plazo")).toBeInTheDocument();
    expect(screen.getAllByText("Vencido").length).toBeGreaterThan(0);
    expect(screen.getByText("Futuro")).toBeInTheDocument();
    expect(screen.getByText("Por abrir")).toBeInTheDocument();
    expect(screen.getByText("sin valor")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("2025-01-01")).toBeInTheDocument();
  });

  it("adds, renames and deletes cdt catalog rows", async () => {
    const user = userEvent.setup();
    api.banks.mockRejectedValueOnce(new Error("sin cdts"));
    const failed = shell(<CdtsCatalog />);
    expect(await screen.findByText("sin cdts")).toBeInTheDocument();
    failed.unmount();

    api.banks.mockResolvedValueOnce([]);
    api.cdts.mockResolvedValueOnce([]);
    const empty = shell(<CdtsCatalog />);
    expect(await screen.findByText("CDTs")).toBeInTheDocument();
    fireEvent.submit(screen.getAllByRole("button", { name: "Agregar" })[1].closest("form")!);
    expect(api.createCdt).not.toHaveBeenCalled();
    empty.unmount();

    shell(<CdtsCatalog />);
    expect((await screen.findAllByText("Bancolombia")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vencido/).length).toBeGreaterThan(0);
    expect(screen.getByText(/sin valor/)).toBeInTheDocument();
    expect(screen.getByText("Activar")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Bancos"), "Nuevo");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    await waitFor(() => expect(api.createBank).toHaveBeenCalledWith("Nuevo"));

    await user.type(screen.getByLabelText("CDTs"), "Marzo");
    await user.selectOptions(screen.getByLabelText("Banco"), "91");
    await user.selectOptions(screen.getByLabelText("Moneda del CDT"), "USD");
    fireEvent.change(screen.getByLabelText("Valor inversión"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Tasa efectiva anual (%)"), { target: { value: "9.5" } });
    fireEvent.change(screen.getByLabelText("Plazo (días)"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Fecha de apertura"), { target: { value: "2025-03-01" } });
    fireEvent.change(screen.getByLabelText("Fecha de vencimiento"), { target: { value: "2026-03-01" } });
    await user.selectOptions(screen.getByLabelText("Modalidad pago rendimientos"), "in_advance");
    await user.selectOptions(screen.getByLabelText("Periodicidad de pago de rendimientos"), "monthly");
    fireEvent.change(screen.getByLabelText("Rendimientos último periodo"), { target: { value: "186405" } });
    fireEvent.change(screen.getByLabelText("Rendimientos netos último periodo"), { target: { value: "178949" } });
    fireEvent.change(screen.getByLabelText("Retención en la fuente"), { target: { value: "7456" } });
    await user.click(screen.getByRole("checkbox", { name: "Capitalización de rendimientos" }));
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    await waitFor(() =>
      expect(api.createCdt).toHaveBeenCalledWith({
        name: "Marzo",
        bank_id: 91,
        currency: "USD",
        principal: "500",
        annual_rate: "9.5",
        opened_on: "2025-03-01",
        matures_on: "2026-03-01",
        term_days: "180",
        yield_payment: "in_advance",
        payment_frequency: "monthly",
        capitalize: true,
        gross_yield: "186405",
        net_yield: "178949",
        withholding: "7456",
      }),
    );

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const same = screen.getByLabelText("Nombre");
    await user.clear(same);
    fireEvent.submit(same.closest("form")!);
    await user.type(same, "Bancolombia SA");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchBank).toHaveBeenCalledWith(90, "Bancolombia SA"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getAllByRole("button", { name: "Editar" })[2]);
    const cdtDraft = screen.getByLabelText("Nombre");
    await user.clear(cdtDraft);
    await user.type(cdtDraft, "Plazo largo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.patchCdt).toHaveBeenCalledWith(92, { name: "Plazo largo" }));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    await waitFor(() => expect(api.patchCdt).toHaveBeenCalledWith(92, { active: false }));

    window.confirm = vi.fn(() => false);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    expect(api.deleteBank).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    await waitFor(() => expect(api.deleteBank).toHaveBeenCalledWith(90));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[2]);
    await waitFor(() => expect(api.deleteCdt).toHaveBeenCalledWith(92));

    api.createBank.mockRejectedValueOnce(new Error("banco"));
    await user.type(screen.getByLabelText("Bancos"), "Z");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("banco")).toBeInTheDocument();
    api.createBank.mockRejectedValueOnce("x");
    await user.type(screen.getByLabelText("Bancos"), "Y");
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[0]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
    api.createCdt.mockRejectedValueOnce(new Error("cdt"));
    await user.type(screen.getByLabelText("CDTs"), "Q");
    fireEvent.change(screen.getByLabelText("Valor inversión"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tasa efectiva anual (%)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Plazo (días)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Fecha de apertura"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("Fecha de vencimiento"), { target: { value: "2026-01-01" } });
    await user.click(screen.getAllByRole("button", { name: "Agregar" })[1]);
    expect(await screen.findByText("cdt")).toBeInTheDocument();
    api.patchCdt.mockRejectedValueOnce(new Error("no toggle"));
    await user.click(screen.getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("no toggle")).toBeInTheDocument();
    api.patchBank.mockRejectedValueOnce(new Error("nombre"));
    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const again = screen.getByLabelText("Nombre");
    await user.clear(again);
    await user.type(again, "Otra banco");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("nombre")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    api.deleteCdt.mockRejectedValueOnce(new Error("no borra"));
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[2]);
    expect(await screen.findByText("no borra")).toBeInTheDocument();
    api.deleteCdt.mockRejectedValueOnce("x");
    await user.click(screen.getAllByRole("button", { name: "Borrar" })[2]);
    expect(await screen.findByText("Error")).toBeInTheDocument();
  });

  it("switches into the cdt module", async () => {
    const user = userEvent.setup();
    const book = shell(<App />, "/cdts");
    expect(await screen.findByText("Plazo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumen" })).toHaveClass("bg-accent");
    expect(screen.queryByRole("link", { name: "Precios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Saldos" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Catálogo" }));
    await screen.findByText("Bancos");
    await user.selectOptions(screen.getByLabelText("Módulo"), "equities");
    await screen.findByText("Ecopetrol");
    book.unmount();

    shell(<App />, "/prices");
    await screen.findByRole("button", { name: "Guardar cambios" });
    await user.selectOptions(screen.getByLabelText("Módulo"), "cdts");
    await screen.findByText("Bancos");
    await user.selectOptions(screen.getByLabelText("Módulo"), "funds");
    await screen.findByText("FIC Uno");
  });
});
