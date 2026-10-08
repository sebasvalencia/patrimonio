import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Asset, type Wealth } from "../api";
import { asMoneyCurrency, formatMoney } from "../format";
import { useCurrency } from "../currency";
import { useDisplayPositions } from "./PortfolioBlock";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function sumDisplay(rows: { valueDisplay: number | null }[]): number {
  return rows.reduce((acc, row) => acc + Number(row.valueDisplay), 0);
}

export default function Patrimonio() {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [wealth, setWealth] = useState<Wealth | null>(null);
  const [goods, setGoods] = useState<Asset[]>([]);
  const [name, setName] = useState("");
  const [money, setMoney] = useState<"COP" | "USD">("COP");
  const [value, setValue] = useState("");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("9");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assetRows = useDisplayPositions(wealth?.assets.positions ?? []);
  const equityRows = useDisplayPositions(wealth?.equities.positions ?? []);
  const fundRows = useDisplayPositions(wealth?.funds.positions ?? []);
  const reserveRows = useDisplayPositions(wealth?.reserves.positions ?? []);
  const cdtRows = useDisplayPositions(wealth?.cdts.positions ?? []);
  const total =
    sumDisplay(assetRows) +
    sumDisplay(equityRows) +
    sumDisplay(fundRows) +
    sumDisplay(reserveRows) +
    sumDisplay(cdtRows);

  async function load() {
    const [book, rows] = await Promise.all([api.wealth(), api.assets()]);
    setWealth(book);
    setGoods(rows);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(message(err, t("common.error"))));
  }, []);

  function resetForm() {
    setName("");
    setMoney("COP");
    setValue("");
    setYear("2026");
    setMonth("9");
    setEditing(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: name.trim(),
      currency: money,
      value: value.trim(),
      year: Number(year),
      month: Number(month),
    };
    try {
      if (editing == null) await api.createAsset(body);
      else await api.patchAsset(editing, body);
      resetForm();
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  function startEdit(row: Asset) {
    setEditing(row.id);
    setName(row.name);
    setMoney(row.currency);
    setValue(row.value);
    setYear(String(row.year));
    setMonth(String(row.month));
  }

  async function toggle(row: Asset) {
    setError(null);
    try {
      await api.patchAsset(row.id, { active: !row.active });
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function remove(row: Asset) {
    if (!window.confirm(t("patrimonio.confirmDelete"))) return;
    setError(null);
    try {
      await api.deleteAsset(row.id);
      if (editing === row.id) resetForm();
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-muted">{t("patrimonio.title")}</p>
        <p className="font-display text-4xl">{formatMoney(total, currency)}</p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {assetRows.map((row) => (
              <tr key={row.instrument_id}>
                <td className="py-1 pr-3">{row.instrument_name}</td>
                <td className="py-1">
                  {row.valueDisplay == null ? t("patrimonio.noValue") : formatMoney(row.valueDisplay, currency)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-3">{t("patrimonio.equities")}</td>
              <td className="py-1">{formatMoney(sumDisplay(equityRows), currency)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3">{t("patrimonio.funds")}</td>
              <td className="py-1">{formatMoney(sumDisplay(fundRows), currency)}</td>
            </tr>
            {reserveRows.map((row) => (
              <tr key={row.instrument_id}>
                <td className="py-1 pr-3">{row.instrument_name}</td>
                <td className="py-1">
                  {row.valueDisplay == null ? t("patrimonio.noValue") : formatMoney(row.valueDisplay, currency)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-3">{t("patrimonio.cdts")}</td>
              <td className="py-1">{formatMoney(sumDisplay(cdtRows), currency)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">{t("patrimonio.goods")}</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={save}>
          <Field label={t("patrimonio.name")}>
            <input
              aria-label={t("patrimonio.name")}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label={t("patrimonio.currency")}>
            <select
              aria-label={t("patrimonio.currency")}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink"
              value={money}
              onChange={(e) => setMoney(e.target.value as "COP" | "USD")}
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label={t("patrimonio.value")}>
            <input
              aria-label={t("patrimonio.value")}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </Field>
          <Field label={t("common.year")}>
            <input
              aria-label={t("common.year")}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </Field>
          <Field label={t("common.month")}>
            <input
              aria-label={t("common.month")}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </Field>
          <button type="submit" className="rounded bg-accent px-3 py-1 text-sm text-ink">
            {editing == null ? t("common.add") : t("common.save")}
          </button>
          {editing != null && (
            <button type="button" className="rounded px-3 py-1 text-sm text-muted" onClick={resetForm}>
              {t("common.cancel")}
            </button>
          )}
        </form>
        <ul className="space-y-2 text-sm">
          {goods.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3">
              <span>
                {row.name} · {row.currency} · {formatMoney(Number(row.value), asMoneyCurrency(row.currency))} · {row.year}-{row.month}
                {row.active ? "" : ` · ${t("common.inactive")}`}
              </span>
              <button type="button" className="text-accent" onClick={() => startEdit(row)}>
                {t("common.edit")}
              </button>
              <button type="button" className="text-muted" onClick={() => toggle(row)}>
                {row.active ? t("common.inactivate") : t("common.activate")}
              </button>
              <button type="button" className="text-down" onClick={() => remove(row)}>
                {t("common.delete")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
