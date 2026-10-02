import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type FxRate } from "../api";
import { useCurrency } from "../currency";
import { currentMonth } from "../BannerPrecios";

export default function FxRates() {
  const { t } = useTranslation();
  const { refreshRates } = useCurrency();
  const current = currentMonth();
  const [year, setYear] = useState(current.year);
  const [rows, setRows] = useState<FxRate[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const months = t("months.short", { returnObjects: true }) as string[];

  async function load(y: number) {
    setRows(await api.fxRates(y));
  }

  useEffect(() => {
    load(year).catch((e: Error) => setError(e.message));
  }, [year]);

  function value(month: number): string {
    const key = String(month);
    if (key in draft) return draft[key];
    const found = rows.find((r) => r.month === month);
    if (!found) return "";
    return found.cop_per_usd;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      for (const [key, raw] of Object.entries(draft)) {
        if (raw.trim() === "") continue;
        await api.upsertFxRate({
          year,
          month: Number(key),
          cop_per_usd: raw.trim(),
        });
      }
      setDraft({});
      await load(year);
      refreshRates();
      setOk(t("fx.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function fetchOfficial() {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const saved = await api.importOfficialFx(year);
      setRows(saved);
      setDraft((currentDraft) => {
        const next = { ...currentDraft };
        for (const row of saved) delete next[String(row.month)];
        return next;
      });
      refreshRates();
      setOk(t("fx.fetched"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {error && (
        <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}
      {ok && <p className="rounded border border-up/40 bg-up/10 px-3 py-2 text-sm text-up">{ok}</p>}
      <section className="rounded-lg bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl">{t("fx.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("fx.hint")}</p>
        <div className="mt-4 flex items-end gap-3">
          <label className="text-sm">
            {t("common.year")}
            <input
              className="ml-2 rounded border border-line px-2 py-1"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <button className="rounded bg-accent px-4 py-2 text-sm text-white" type="submit" disabled={busy}>
            {t("common.saveChanges")}
          </button>
          <button
            className="rounded border border-line px-4 py-2 text-sm"
            type="button"
            onClick={fetchOfficial}
            disabled={busy}
          >
            {t("fx.fetch")}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b">
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
              <tr>
                {months.map((_, idx) => {
                  const month = idx + 1;
                  const gap =
                    year === current.year && month === current.month && value(month) === "";
                  return (
                    <td key={month}>
                      <input
                        className={`w-24 rounded border px-1 py-1 text-right ${
                          gap ? "border-warn bg-warn/10" : "border-line"
                        }`}
                        value={value(month)}
                        onChange={(e) => setDraft((d) => ({ ...d, [String(month)]: e.target.value }))}
                        inputMode="decimal"
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
