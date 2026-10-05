import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FundTradePayload, TradePayload } from "./api";

function jsonResponse(body: unknown, status = 200, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

const trade: TradePayload = {
  instrument_id: 1,
  broker_id: 2,
  type: "buy",
  year: 2026,
  month: null,
  quantity: "1",
  commission: "0",
  price: null,
};

const fundTrade: FundTradePayload = {
  fund_id: 1,
  fiduciary_id: 2,
  type: "subscribe",
  year: 2026,
  month: 1,
  quantity: "1",
  commission: "0",
  price: "1",
};

async function loadApi(origin?: string) {
  vi.resetModules();
  if (origin) vi.stubEnv("VITE_API_URL", origin);
  else vi.unstubAllEnvs();
  return import("./api");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("calls every endpoint and uses the configured origin", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return jsonResponse(undefined, 204, "No Content");
      return jsonResponse({ id: 1, status: "ok" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi("http://api.test");

    await api.health();
    await api.brokers();
    await api.createBroker("A");
    await api.patchBroker(1, "B");
    await api.instruments();
    await api.createInstrument("Eco");
    await api.createInstrument("AAPL", "USD");
    await api.patchInstrument(1, { active: false });
    await api.trades();
    await api.createTrade(trade);
    await api.updateTrade(1, trade);
    await expect(api.deleteTrade(1)).resolves.toBeUndefined();
    await api.prices();
    await api.prices(2026);
    await api.upsertPrice({ instrument_id: 1, year: 2026, month: 1, price: "1" });
    await api.pendingPrices(2026, 1);
    await api.summary();
    await api.variation(1);
    await api.targets(1);
    await api.upsertTarget({ instrument_id: 1, year: 2026, month: 1, price: "1" });
    await api.targetProgress(1);
    await api.fxRates();
    await api.fxRates(2026);
    await api.importOfficialFx(2026);
    await api.upsertFxRate({ year: 2026, month: 1, cop_per_usd: "4000" });
    await api.wealth();
    await api.fiduciaries();
    await api.createFiduciary("Fid");
    await api.patchFiduciary(1, "Fid 2");
    await api.funds();
    await api.createFund("FIC");
    await api.createFund("FIC USD", "USD");
    await api.patchFund(1, { name: "FIC" });
    await api.fundTrades();
    await api.createFundTrade(fundTrade);
    await api.updateFundTrade(1, fundTrade);
    await expect(api.deleteFundTrade(1)).resolves.toBeUndefined();
    await api.fundUnitValues();
    await api.fundUnitValues(2026);
    await api.upsertFundUnitValue({ fund_id: 1, year: 2026, month: 1, value: "1" });
    await api.pendingFundUnitValues(2026, 1);
    await api.fundSummary();
    await api.fundVariation(1);
    await api.fundTargets(1);
    await api.upsertFundTarget({ fund_id: 1, year: 2026, month: 1, price: "1" });
    await api.fundTargetProgress(1);
    await api.institutions();
    await api.createInstitution("Protección");
    await api.patchInstitution(1, "Protección");
    await expect(api.deleteInstitution(1)).resolves.toBeUndefined();
    await api.reserveAccounts();
    await api.createReserveAccount({
      name: "Ceiba",
      institution_id: 1,
      currency: "COP",
      purpose: "official_pension",
      liquid: false,
    });
    await api.patchReserveAccount(1, { active: false });
    await expect(api.deleteReserveAccount(1)).resolves.toBeUndefined();
    await api.reserveBalances(2024);
    await api.upsertReserveBalance({
      account_id: 1,
      year: 2024,
      month: 6,
      balance: "100",
    });
    await api.banks();
    await api.createBank("Bancolombia");
    await api.patchBank(1, "Bancolombia");
    await expect(api.deleteBank(1)).resolves.toBeUndefined();
    await api.cdts();
    await api.createCdt({
      name: "Plazo",
      bank_id: 1,
      currency: "COP",
      principal: "1000",
      annual_rate: "10",
      opened_on: "2025-01-01",
      matures_on: "2026-01-01",
      term_days: "180",
      yield_payment: "at_maturity",
      payment_frequency: "single",
      capitalize: true,
      gross_yield: "186405",
      net_yield: "178949",
      withholding: "7456",
    });
    await api.patchCdt(1, { active: false });
    await expect(api.deleteCdt(1)).resolves.toBeUndefined();

    expect(String(fetchMock.mock.calls[0][0])).toBe("http://api.test/health");
  });

  it("falls back to localhost and surfaces error bodies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: "broker_not_found" }, 404, "Not Found"))
      .mockResolvedValueOnce(jsonResponse({ detail: [{ msg: "year" }, {}] }, 422, "Unprocessable"))
      .mockResolvedValueOnce(jsonResponse({ detail: 5 }, 500, "Server"))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Broken",
        json: async () => {
          throw new Error("not json");
        },
      });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await loadApi();

    await expect(api.health()).rejects.toThrow(/./);
    await expect(api.health()).rejects.toThrow("year; ");
    await expect(api.health()).rejects.toThrow("Server");
    await expect(api.health()).rejects.toThrow("Broken");
    expect(String(fetchMock.mock.calls[0][0])).toContain("http://localhost:8000/health");
  });
});
