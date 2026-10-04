import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { currentMonth } from "../../BannerPrecios";
import { api, type ReserveAccount, type ReserveBalance } from "../../api";

export default function ReserveBalances() {
  const { t } = useTranslation();
  const current = currentMonth();
  const [year, setYear] = useState(current.year);
  const [accounts, setAccounts] = useState<ReserveAccount[]>([]);
  const [balances, setBalances] = useState<ReserveBalance[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const months = t("months.short", { returnObjects: true }) as string[];

  async function load(selected: number) {
    const [rows, saved] = await Promise.all([api.reserveAccounts(), api.reserveBalances(selected)]);
    setAccounts(rows);
    setBalances(saved);
  }

  useEffect(() => {
    load(year).catch((e: Error) => setError(e.message));
  }, [year]);

  function cell(accountId: number, month: number): string {
    const key = `${accountId}-${month}`;
    if (key in draft) return draft[key];
    const found = balances.find((row) => row.account_id === accountId && row.month === month);
    if (!found) return "";
    return found.balance;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      for (const [key, raw] of Object.entries(draft)) {
        if (raw.trim() === "") continue;
        const [id, month] = key.split("-").map(Number);
        await api.upsertReserveBalance({
          account_id: id,
          year,
          month,
          balance: raw.trim(),
        });
      }
      setDraft({});
      await load(year);
      setOk(t("reserves.balances.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
      {ok && <p className="rounded border border-up/40 bg-up/10 px-3 py-2 text-sm text-up">{ok}</p>}
      <div className="flex items-end gap-3">
        <label className="text-sm">
          {t("common.year")}
          <input
            className="ml-2 rounded border border-line px-2 py-1"
            type="number"
            aria-label={t("common.year")}
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
              <th className="py-2 pr-2">{t("reserves.summary.account")}</th>
              {months.map((label, idx) => (
                <th
                  key={label}
                  className={`px-1 text-center ${
                    year === current.year && idx + 1 === current.month ? "text-accent" : ""
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-line">
                <td className="whitespace-nowrap py-1 pr-2 font-medium">
                  {account.name}{" "}
                  <span className="text-[10px] font-normal text-muted">
                    {account.institution_name} · {t(`reserves.purpose.${account.purpose}`)}
                  </span>
                </td>
                {months.map((_, idx) => {
                  const month = idx + 1;
                  const key = `${account.id}-${month}`;
                  const gap =
                    account.active &&
                    year === current.year &&
                    month === current.month &&
                    cell(account.id, month) === "";
                  return (
                    <td key={month}>
                      <input
                        className={`w-20 rounded border px-1 py-1 text-right ${
                          gap ? "border-warn bg-warn/10" : "border-line"
                        }`}
                        value={cell(account.id, month)}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        inputMode="decimal"
                        aria-label={`${account.name} ${months[idx]}`}
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
