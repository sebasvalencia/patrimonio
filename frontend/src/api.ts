import { translateApiError } from "./apiErrors";

export type Broker = { id: number; name: string };
export type Instrument = { id: number; name: string; active: boolean; currency: "COP" | "USD" };
export type Trade = {
  id: number;
  instrument_id: number;
  broker_id: number;
  type: "buy" | "sell";
  year: number;
  month: number | null;
  quantity: string;
  commission: string;
  price: string | null;
  instrument_name: string | null;
  broker_name: string | null;
  instrument_currency: "COP" | "USD" | null;
};
export type PendingPrices = {
  year: number;
  month: number;
  total_active: number;
  pending: number;
  missing: { instrument_id: number; instrument_name: string }[];
};
export type Price = {
  id: number;
  instrument_id: number;
  year: number;
  month: number;
  price: string;
  instrument_name: string | null;
  instrument_currency: "COP" | "USD" | null;
};
export type Position = {
  instrument_id: number;
  instrument_name: string;
  broker_id: number;
  broker_name: string;
  balance: string;
  last_price: string | null;
  price_year: number | null;
  price_month: number | null;
  value: string | null;
  weight_pct: string | null;
  missing_price: boolean;
  instrument_currency: "COP" | "USD";
};
export type Summary = { total: string | null; positions: Position[] };
export type TradePayload = {
  instrument_id: number;
  broker_id: number;
  type: "buy" | "sell";
  year: number;
  month: number | null;
  quantity: string;
  commission: string;
  price: string | null;
};
export type Target = {
  id: number;
  instrument_id: number;
  year: number;
  month: number;
  price: string;
  instrument_name: string | null;
  instrument_currency: "COP" | "USD" | null;
};
export type TargetProgress = {
  instrument_id: number;
  instrument_name: string;
  last_price: string | null;
  price_year: number | null;
  price_month: number | null;
  target: string | null;
  target_year: number | null;
  target_month: number | null;
  progress_pct: string | null;
  instrument_currency: "COP" | "USD";
};
export type Variation = {
  instrument_id: number;
  instrument_name: string;
  instrument_currency: "COP" | "USD";
  points: {
    year: number;
    month: number;
    price: string;
    variation_pct: string | null;
  }[];
};
export type FxRate = {
  id: number;
  year: number;
  month: number;
  cop_per_usd: string;
};
export type Fiduciary = { id: number; name: string };
export type Fund = { id: number; name: string; active: boolean; currency: "COP" | "USD" };
export type FundTrade = {
  id: number;
  fund_id: number;
  fiduciary_id: number;
  type: "subscribe" | "redeem";
  year: number;
  month: number | null;
  quantity: string;
  commission: string;
  price: string | null;
  fund_name: string | null;
  fiduciary_name: string | null;
  fund_currency: "COP" | "USD" | null;
};
export type FundTradePayload = {
  fund_id: number;
  fiduciary_id: number;
  type: "subscribe" | "redeem";
  year: number;
  month: number | null;
  quantity: string;
  commission: string;
  price: string | null;
};
export type UnitValue = {
  id: number;
  fund_id: number;
  year: number;
  month: number;
  value: string;
  fund_name: string | null;
  fund_currency: "COP" | "USD" | null;
};
export type PendingUnitValues = {
  year: number;
  month: number;
  total_active: number;
  pending: number;
  missing: { fund_id: number; fund_name: string }[];
};
export type FundTarget = {
  id: number;
  fund_id: number;
  year: number;
  month: number;
  price: string;
  fund_name: string | null;
  fund_currency: "COP" | "USD" | null;
};
export type FundTargetProgress = {
  fund_id: number;
  fund_name: string;
  last_price: string | null;
  price_year: number | null;
  price_month: number | null;
  target: string | null;
  target_year: number | null;
  target_month: number | null;
  progress_pct: string | null;
  fund_currency: "COP" | "USD";
};
export type FundVariation = {
  fund_id: number;
  fund_name: string;
  fund_currency: "COP" | "USD";
  points: {
    year: number;
    month: number;
    price: string;
    variation_pct: string | null;
  }[];
};
export type ReservePurpose = "official_pension" | "severance" | "voluntary_pension" | "emergency";
export type Institution = { id: number; name: string };
export type ReserveAccount = {
  id: number;
  name: string;
  institution_id: number;
  institution_name: string;
  currency: "COP" | "USD";
  purpose: ReservePurpose;
  liquid: boolean;
  active: boolean;
};
export type ReserveBalance = {
  id: number;
  account_id: number;
  year: number;
  month: number;
  balance: string;
  account_name: string;
  institution_name: string;
  currency: "COP" | "USD";
  purpose: ReservePurpose;
  liquid: boolean;
};
export type ReservePosition = Position & {
  purpose: ReservePurpose;
  liquid: boolean;
};
export type CdtStatus = "upcoming" | "accruing" | "matured";
export type YieldPayment = "at_maturity" | "in_advance";
export type PaymentFrequency = "single" | "monthly" | "quarterly" | "semiannual" | "annual";
export type Bank = { id: number; name: string };
export type CdtCertificate = {
  term_days: number;
  yield_payment: YieldPayment;
  payment_frequency: PaymentFrequency;
  capitalize: boolean;
  gross_yield: string;
  net_yield: string;
  withholding: string;
};
export type Cdt = {
  id: number;
  name: string;
  bank_id: number;
  bank_name: string;
  currency: "COP" | "USD";
  principal: string;
  annual_rate: string;
  opened_on: string;
  matures_on: string;
  active: boolean;
  value: string | null;
  status: CdtStatus;
  liquid: boolean;
} & CdtCertificate;
export type CdtPosition = Position & {
  annual_rate: string;
  opened_on: string;
  matures_on: string;
  status: CdtStatus;
  liquid: boolean;
} & CdtCertificate;
export type Wealth = {
  equities: Summary;
  funds: Summary;
  reserves: { total: string | null; positions: ReservePosition[] };
  cdts: { total: string | null; positions: CdtPosition[] };
  total: string | null;
};

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = translateApiError(body.detail);
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
    } catch {
      /* keep statusText */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string }>("/health"),
  brokers: () => req<Broker[]>("/brokers"),
  createBroker: (name: string) =>
    req<Broker>("/brokers", { method: "POST", body: JSON.stringify({ name }) }),
  patchBroker: (id: number, name: string) =>
    req<Broker>(`/brokers/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  instruments: () => req<Instrument[]>("/instruments"),
  createInstrument: (name: string, currency: "COP" | "USD" = "COP") =>
    req<Instrument>("/instruments", { method: "POST", body: JSON.stringify({ name, active: true, currency }) }),
  patchInstrument: (id: number, body: { active?: boolean; name?: string; currency?: "COP" | "USD" }) =>
    req<Instrument>(`/instruments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  trades: () => req<Trade[]>("/trades"),
  createTrade: (body: TradePayload) =>
    req<Trade>("/trades", { method: "POST", body: JSON.stringify(body) }),
  updateTrade: (id: number, body: TradePayload) =>
    req<Trade>(`/trades/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTrade: (id: number) => req<void>(`/trades/${id}`, { method: "DELETE" }),
  prices: (year?: number) => req<Price[]>(year ? `/prices?year=${year}` : "/prices"),
  upsertPrice: (body: { instrument_id: number; year: number; month: number; price: string }) =>
    req<Price>("/prices", { method: "PUT", body: JSON.stringify(body) }),
  pendingPrices: (year: number, month: number) =>
    req<PendingPrices>(`/prices/pending?year=${year}&month=${month}`),
  summary: () => req<Summary>("/summary"),
  variation: (instrumentId: number) =>
    req<Variation>(`/price-variation?instrument_id=${instrumentId}`),
  targets: (instrumentId: number) => req<Target[]>(`/targets?instrument_id=${instrumentId}`),
  upsertTarget: (body: { instrument_id: number; year: number; month: number; price: string }) =>
    req<Target>("/targets", { method: "PUT", body: JSON.stringify(body) }),
  targetProgress: (instrumentId: number) =>
    req<TargetProgress>(`/target-progress?instrument_id=${instrumentId}`),
  fxRates: (year?: number) => req<FxRate[]>(year ? `/fx-rates?year=${year}` : "/fx-rates"),
  importOfficialFx: (year: number) =>
    req<FxRate[]>(`/fx-rates/official?year=${year}`, { method: "POST" }),
  upsertFxRate: (body: { year: number; month: number; cop_per_usd: string }) =>
    req<FxRate>("/fx-rates", { method: "PUT", body: JSON.stringify(body) }),
  wealth: () => req<Wealth>("/wealth"),
  fiduciaries: () => req<Fiduciary[]>("/funds/fiduciaries"),
  createFiduciary: (name: string) =>
    req<Fiduciary>("/funds/fiduciaries", { method: "POST", body: JSON.stringify({ name }) }),
  patchFiduciary: (id: number, name: string) =>
    req<Fiduciary>(`/funds/fiduciaries/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  funds: () => req<Fund[]>("/funds/funds"),
  createFund: (name: string, currency: "COP" | "USD" = "COP") =>
    req<Fund>("/funds/funds", { method: "POST", body: JSON.stringify({ name, active: true, currency }) }),
  patchFund: (id: number, body: { active?: boolean; name?: string; currency?: "COP" | "USD" }) =>
    req<Fund>(`/funds/funds/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  fundTrades: () => req<FundTrade[]>("/funds/trades"),
  createFundTrade: (body: FundTradePayload) =>
    req<FundTrade>("/funds/trades", { method: "POST", body: JSON.stringify(body) }),
  updateFundTrade: (id: number, body: FundTradePayload) =>
    req<FundTrade>(`/funds/trades/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFundTrade: (id: number) => req<void>(`/funds/trades/${id}`, { method: "DELETE" }),
  fundUnitValues: (year?: number) =>
    req<UnitValue[]>(year ? `/funds/unit-values?year=${year}` : "/funds/unit-values"),
  upsertFundUnitValue: (body: { fund_id: number; year: number; month: number; value: string }) =>
    req<UnitValue>("/funds/unit-values", { method: "PUT", body: JSON.stringify(body) }),
  pendingFundUnitValues: (year: number, month: number) =>
    req<PendingUnitValues>(`/funds/unit-values/pending?year=${year}&month=${month}`),
  fundSummary: () => req<Summary>("/funds/summary"),
  fundVariation: (fundId: number) =>
    req<FundVariation>(`/funds/price-variation?fund_id=${fundId}`),
  fundTargets: (fundId: number) => req<FundTarget[]>(`/funds/targets?fund_id=${fundId}`),
  upsertFundTarget: (body: { fund_id: number; year: number; month: number; price: string }) =>
    req<FundTarget>("/funds/targets", { method: "PUT", body: JSON.stringify(body) }),
  fundTargetProgress: (fundId: number) =>
    req<FundTargetProgress>(`/funds/target-progress?fund_id=${fundId}`),
  institutions: () => req<Institution[]>("/reserves/institutions"),
  createInstitution: (name: string) =>
    req<Institution>("/reserves/institutions", { method: "POST", body: JSON.stringify({ name }) }),
  patchInstitution: (id: number, name: string) =>
    req<Institution>(`/reserves/institutions/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteInstitution: (id: number) => req<void>(`/reserves/institutions/${id}`, { method: "DELETE" }),
  reserveAccounts: () => req<ReserveAccount[]>("/reserves/accounts"),
  createReserveAccount: (body: {
    name: string;
    institution_id: number;
    currency: "COP" | "USD";
    purpose: ReservePurpose;
    liquid: boolean;
  }) => req<ReserveAccount>("/reserves/accounts", { method: "POST", body: JSON.stringify(body) }),
  patchReserveAccount: (
    id: number,
    body: { active?: boolean; name?: string; liquid?: boolean; currency?: "COP" | "USD"; purpose?: ReservePurpose; institution_id?: number },
  ) => req<ReserveAccount>(`/reserves/accounts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteReserveAccount: (id: number) => req<void>(`/reserves/accounts/${id}`, { method: "DELETE" }),
  reserveBalances: (year: number) => req<ReserveBalance[]>(`/reserves/balances?year=${year}`),
  upsertReserveBalance: (body: { account_id: number; year: number; month: number; balance: string }) =>
    req<ReserveBalance>("/reserves/balances", { method: "PUT", body: JSON.stringify(body) }),
  banks: () => req<Bank[]>("/cdts/banks"),
  createBank: (name: string) =>
    req<Bank>("/cdts/banks", { method: "POST", body: JSON.stringify({ name }) }),
  patchBank: (id: number, name: string) =>
    req<Bank>(`/cdts/banks/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteBank: (id: number) => req<void>(`/cdts/banks/${id}`, { method: "DELETE" }),
  cdts: () => req<Cdt[]>("/cdts"),
  createCdt: (body: {
    name: string;
    bank_id: number;
    currency: "COP" | "USD";
    principal: string;
    annual_rate: string;
    opened_on: string;
    matures_on: string;
    term_days: string;
    yield_payment: YieldPayment;
    payment_frequency: PaymentFrequency;
    capitalize: boolean;
    gross_yield: string;
    net_yield: string;
    withholding: string;
  }) => req<Cdt>("/cdts", { method: "POST", body: JSON.stringify(body) }),
  patchCdt: (
    id: number,
    body: {
      active?: boolean;
      name?: string;
      bank_id?: number;
      currency?: "COP" | "USD";
      principal?: string;
      annual_rate?: string;
      opened_on?: string;
      matures_on?: string;
      term_days?: number;
      yield_payment?: YieldPayment;
      payment_frequency?: PaymentFrequency;
      capitalize?: boolean;
      gross_yield?: string;
      net_yield?: string;
      withholding?: string;
    },
  ) => req<Cdt>(`/cdts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCdt: (id: number) => req<void>(`/cdts/${id}`, { method: "DELETE" }),
};
