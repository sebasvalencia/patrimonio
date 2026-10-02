import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import BannerPrecios, { currentMonth } from "../../BannerPrecios";
import { api, type Fund, type UnitValue } from "../../api";

export default function FundsPrices() {
  const { t } = useTranslation();
  const current = currentMonth();
  const [year, setYear] = useState(current.year);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [values, setValues] = useState<UnitValue[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [notice, setNotice] = useState(0);
  const months = t("months.short", { returnObjects: true }) as string[];

  async function load(y: number) {
    const [f, p] = await Promise.all([api.funds(), api.fundUnitValues(y)]);
    setFunds(f);
    setValues(p);
  }

  useEffect(() => {
    load(year).catch((e: Error) => setError(e.message));
  }, [year]);

  function cell(fundId: number, month: number): string {
    const key = `${fundId}-${month}`;
    if (key in draft) return draft[key];
    const found = values.find((p) => p.fund_id === fundId && p.month === month);
    if (!found) return "";
    return found.value;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      for (const [key, raw] of Object.entries(draft)) {
        if (raw.trim() === "") continue;
        const [id, month] = key.split("-").map(Number);
        await api.upsertFundUnitValue({
          fund_id: id,
          year,
          month,
          value: raw.trim(),
        });
      }
      setDraft({});
      await load(year);
      setNotice((n) => n + 1);
      setOk(t("funds.prices.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <BannerPrecios reload={notice} kind="funds" />
      {error && (
        <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}
      {ok && <p className="rounded border border-up/40 bg-up/10 px-3 py-2 text-sm text-up">{ok}</p>}
      <div className="flex items-end gap-3">
        <label className="text-sm">
          {t("common.year")}
          <input
            className="ml-2 rounded border border-line px-2 py-1"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <button className="rounded bg-accent px-4 py-2 text-sm text-white" type="submit">
          {t("common.saveChanges")}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg bg-surface p-4 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-2">{t("funds.prices.fund")}</th>
              {months.map((m, idx) => (
                <th
                  key={m}
                  className={`px-1 text-center ${
                    year === current.year && idx + 1 === current.month ? "text-accent" : ""
                  }`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => (
              <tr key={fund.id} className="border-b border-line">
                <td className="whitespace-nowrap py-1 pr-2 font-medium">
                  {fund.name}{" "}
                  <span className="text-[10px] font-normal text-muted">{fund.currency}</span>
                </td>
                {months.map((_, idx) => {
                  const month = idx + 1;
                  const key = `${fund.id}-${month}`;
                  const gap =
                    fund.active &&
                    year === current.year &&
                    month === current.month &&
                    cell(fund.id, month) === "";
                  return (
                    <td key={month}>
                      <input
                        className={`w-20 rounded border px-1 py-1 text-right ${
                          gap ? "border-warn bg-warn/10" : "border-line"
                        }`}
                        value={cell(fund.id, month)}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        inputMode="decimal"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
