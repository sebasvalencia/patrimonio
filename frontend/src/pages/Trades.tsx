import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Broker, type Instrument, type Trade } from "../api";
import { useCurrency } from "../currency";
import { asMoneyCurrency, convertMoney, formatMoney, formatNumber } from "../format";

export default function Trades() {
  const { t } = useTranslation();
  const { currency, rates } = useCurrency();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [rows, setRows] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [instrumentId, setInstrumentId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [commission, setCommission] = useState("0");

  async function load() {
    const [i, c, m] = await Promise.all([api.instruments(), api.brokers(), api.trades()]);
    setInstruments(i);
    setBrokers(c);
    setRows(m);
  }

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, []);

  function resetForm() {
    setEditingId(null);
    setInstrumentId("");
    setBrokerId("");
    setType("buy");
    setYear("2026");
    setMonth("");
    setQuantity("");
    setPrice("");
    setCommission("0");
  }

  function payload() {
    return {
      instrument_id: Number(instrumentId),
      broker_id: Number(brokerId),
      type,
      year: Number(year),
      month: month === "" ? null : Number(month),
      quantity,
      commission: commission === "" ? "0" : commission,
      price: price === "" ? null : price,
    };
  }

  function edit(row: Trade) {
    setError(null);
    setEditingId(row.id);
    setInstrumentId(String(row.instrument_id));
    setBrokerId(String(row.broker_id));
    setType(row.type);
    setYear(String(row.year));
    setMonth(row.month == null ? "" : String(row.month));
    setQuantity(row.quantity);
    setPrice(row.price ?? "");
    setCommission(row.commission);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId == null) {
        await api.createTrade(payload());
      } else {
        await api.updateTrade(editingId, payload());
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const selectedInstrument = instruments.find((i) => i.id === Number(instrumentId));
  const nativeCurrency = selectedInstrument?.currency ?? "COP";

  function typeLabel(value: "buy" | "sell"): string {
    return value === "buy" ? t("trades.buy") : t("trades.sell");
  }

  function moneyText(amount: number, row: Trade): string {
    const converted = convertMoney(
      amount,
      asMoneyCurrency(row.instrument_currency),
      currency,
      row.year,
      row.month,
      rates,
    );
    if (converted == null) return t("fx.missing");
    return formatMoney(converted, currency);
  }

  function commissionText(row: Trade): string {
    return moneyText(Number(row.commission), row);
  }

  function priceText(row: Trade): string {
    if (row.price == null) return t("common.dash");
    return moneyText(Number(row.price), row);
  }

  function amountText(row: Trade): string {
    if (row.price == null) return t("common.dash");
    return moneyText(Number(row.quantity) * Number(row.price), row);
  }

  async function remove(row: Trade) {
    if (
      !window.confirm(
        t("trades.confirmDelete", {
          type: typeLabel(row.type),
          instrument: row.instrument_name,
          broker: row.broker_name,
        }),
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteTrade(row.id);
      if (editingId === row.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}
      <section className="rounded-lg bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl">
          {editingId == null ? t("trades.register") : t("trades.edit")}
        </h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            {t("trades.instrument")}
            <select
              className="mt-1 w-full rounded border border-line px-2 py-2"
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              required
            >
              <option value="">{t("common.select")}</option>
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.currency}
                  {i.active ? "" : ` (${t("common.inactive")})`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("trades.broker")}
            <select
              className="mt-1 w-full rounded border border-line px-2 py-2"
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              required
            >
              <option value="">{t("common.select")}</option>
              {brokers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("trades.type")}
            <select
              className="mt-1 w-full rounded border border-line px-2 py-2"
              value={type}
              onChange={(e) => setType(e.target.value as "buy" | "sell")}
            >
              <option value="buy">{t("trades.buy")}</option>
              <option value="sell">{t("trades.sell")}</option>
            </select>
          </label>
          <label className="text-sm">
            {t("common.year")}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            {t("common.monthOptional")}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder={t("common.dash")}
            />
          </label>
          <label className="text-sm">
            {t("trades.quantity")}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={0.000001}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            {t("trades.price", { currency: nativeCurrency })}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={0.000001}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required={editingId == null}
            />
          </label>
          <label className="text-sm">
            {t("trades.commission", { currency: nativeCurrency })}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={0}
              step="any"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button className="rounded bg-accent px-4 py-2 text-sm text-white" type="submit">
              {editingId == null ? t("common.save") : t("common.saveChanges")}
            </button>
            {editingId != null && (
              <button
                className="rounded border border-line px-4 py-2 text-sm"
                type="button"
                onClick={resetForm}
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="overflow-x-auto rounded-lg bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl">{t("trades.history")}</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-2">{t("common.year")}</th>
              <th>{t("common.month")}</th>
              <th>{t("trades.instrument")}</th>
              <th>{t("trades.broker")}</th>
              <th>{t("trades.type")}</th>
              <th className="text-right">{t("trades.quantity")}</th>
              <th className="text-right">{t("trades.price", { currency })}</th>
              <th className="text-right">{t("trades.amount", { currency })}</th>
              <th className="text-right">{t("trades.commission", { currency })}</th>
              <th className="text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2">{r.year}</td>
                <td>{r.month ?? t("common.dash")}</td>
                <td>{r.instrument_name}</td>
                <td>{r.broker_name}</td>
                <td>{typeLabel(r.type)}</td>
                <td className="text-right">{formatNumber(Number(r.quantity))}</td>
                <td className="text-right">{priceText(r)}</td>
                <td className="text-right">{amountText(r)}</td>
                <td className="text-right">{commissionText(r)}</td>
                <td className="space-x-3 text-right">
                  <button type="button" className="text-accent underline" onClick={() => edit(r)}>
                    {t("common.edit")}
                  </button>
                  <button type="button" className="text-muted underline" onClick={() => remove(r)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
