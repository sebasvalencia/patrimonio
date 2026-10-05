import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Bank, type Cdt, type PaymentFrequency, type YieldPayment } from "../../api";
import { asMoneyCurrency, formatMoney } from "../../format";

const YIELD_PAYMENTS: YieldPayment[] = ["at_maturity", "in_advance"];
const FREQUENCIES: PaymentFrequency[] = ["single", "monthly", "quarterly", "semiannual", "annual"];

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

export default function CdtsCatalog() {
  const { t } = useTranslation();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [deposits, setDeposits] = useState<Cdt[]>([]);
  const [bankName, setBankName] = useState("");
  const [cdtName, setCdtName] = useState("");
  const [bankId, setBankId] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("COP");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [opened, setOpened] = useState("");
  const [matures, setMatures] = useState("");
  const [termDays, setTermDays] = useState("");
  const [yieldPayment, setYieldPayment] = useState<YieldPayment>("at_maturity");
  const [frequency, setFrequency] = useState<PaymentFrequency>("single");
  const [capitalize, setCapitalize] = useState(false);
  const [grossYield, setGrossYield] = useState("");
  const [netYield, setNetYield] = useState("");
  const [withholding, setWithholding] = useState("");
  const [editing, setEditing] = useState<{ kind: "bank" | "cdt"; id: number } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [homes, rows] = await Promise.all([api.banks(), api.cdts()]);
    setBanks(homes);
    setDeposits(rows);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(message(err, t("common.error"))));
  }, []);

  useEffect(() => {
    if (!banks.length) {
      setBankId("");
      return;
    }
    if (!banks.some((row) => String(row.id) === bankId)) {
      setBankId(String(banks[0].id));
    }
  }, [banks, bankId]);

  async function addBank(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createBank(bankName.trim());
      setBankName("");
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function addCdt(e: FormEvent) {
    e.preventDefault();
    if (!bankId) return;
    setError(null);
    try {
      await api.createCdt({
        name: cdtName.trim(),
        bank_id: Number(bankId),
        currency,
        principal: principal.trim(),
        annual_rate: rate.trim(),
        opened_on: opened,
        matures_on: matures,
        term_days: termDays.trim(),
        yield_payment: yieldPayment,
        payment_frequency: frequency,
        capitalize,
        gross_yield: grossYield.trim() || "0",
        net_yield: netYield.trim() || "0",
        withholding: withholding.trim() || "0",
      });
      setCdtName("");
      setCurrency("COP");
      setPrincipal("");
      setRate("");
      setOpened("");
      setMatures("");
      setTermDays("");
      setYieldPayment("at_maturity");
      setFrequency("single");
      setCapitalize(false);
      setGrossYield("");
      setNetYield("");
      setWithholding("");
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function toggleActive(row: Cdt) {
    setError(null);
    try {
      await api.patchCdt(row.id, { active: !row.active });
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  function startEdit(kind: "bank" | "cdt", row: { id: number; name: string }) {
    setError(null);
    setEditing({ kind, id: row.id });
    setDraftName(row.name);
  }

  function cancelEdit() {
    setEditing(null);
    setDraftName("");
  }

  async function saveName(kind: "bank" | "cdt", row: { id: number; name: string }, e: FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    if (name === row.name) {
      cancelEdit();
      return;
    }
    setError(null);
    try {
      if (kind === "bank") await api.patchBank(row.id, name);
      else await api.patchCdt(row.id, { name });
      cancelEdit();
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function remove(kind: "bank" | "cdt", row: { id: number; name: string }) {
    const question =
      kind === "bank"
        ? t("cdts.catalog.confirmDeleteBank", { name: row.name })
        : t("cdts.catalog.confirmDeleteCdt", { name: row.name });
    if (!window.confirm(question)) return;
    setError(null);
    try {
      if (kind === "bank") await api.deleteBank(row.id);
      else await api.deleteCdt(row.id);
      cancelEdit();
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {error && (
        <p className="md:col-span-2 rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}
      <section className="rounded-lg bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl">{t("cdts.catalog.banks")}</h2>
        <form onSubmit={addBank} className="mt-3 flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            <span>{t("cdts.catalog.bankName")}</span>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              aria-label={t("cdts.catalog.banks")}
              required
            />
          </label>
          <button className="rounded bg-up px-3 py-2 text-sm text-white" type="submit">
            {t("common.add")}
          </button>
        </form>
        <ul className="mt-4 divide-y">
          {banks.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.kind === "bank" && editing.id === row.id ? (
                <form onSubmit={(e) => void saveName("bank", row, e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input
                    className="min-w-[8rem] flex-1 rounded border border-line px-2 py-1"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label={t("common.name")}
                    autoFocus
                    required
                  />
                  <button className="text-sm text-accent underline" type="submit">
                    {t("common.save")}
                  </button>
                  <button className="text-sm text-muted underline" type="button" onClick={cancelEdit}>
                    {t("common.cancel")}
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0">{row.name}</span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="text-sm text-accent underline" onClick={() => startEdit("bank", row)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void remove("bank", row)}>
                      {t("common.delete")}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl">{t("cdts.catalog.deposits")}</h2>
        <form onSubmit={addCdt} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={t("cdts.catalog.name")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={cdtName}
              onChange={(e) => setCdtName(e.target.value)}
              aria-label={t("cdts.catalog.deposits")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.bank")}>
            <select
              className="rounded border border-line bg-surface-2 px-2 py-2 text-sm text-ink"
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              aria-label={t("cdts.catalog.bank")}
              required
            >
              {banks.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("cdts.catalog.currency")}>
            <select
              className="rounded border border-line bg-surface-2 px-2 py-2 text-sm text-ink"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "COP" | "USD")}
              aria-label={t("cdts.catalog.currency")}
            >
              <option value="COP">{t("currency.cop")}</option>
              <option value="USD">{t("currency.usd")}</option>
            </select>
          </Field>
          <Field label={t("cdts.catalog.principal")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              inputMode="decimal"
              aria-label={t("cdts.catalog.principal")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.rate")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              aria-label={t("cdts.catalog.rate")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.term")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={termDays}
              onChange={(e) => setTermDays(e.target.value)}
              inputMode="numeric"
              aria-label={t("cdts.catalog.term")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.opened")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              type="date"
              value={opened}
              onChange={(e) => setOpened(e.target.value)}
              aria-label={t("cdts.catalog.opened")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.matures")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              type="date"
              value={matures}
              onChange={(e) => setMatures(e.target.value)}
              aria-label={t("cdts.catalog.matures")}
              required
            />
          </Field>
          <Field label={t("cdts.catalog.yieldPayment")}>
            <select
              className="rounded border border-line bg-surface-2 px-2 py-2 text-sm text-ink"
              value={yieldPayment}
              onChange={(e) => setYieldPayment(e.target.value as YieldPayment)}
              aria-label={t("cdts.catalog.yieldPayment")}
            >
              {YIELD_PAYMENTS.map((item) => (
                <option key={item} value={item}>
                  {t(`cdts.yieldPayment.${item}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("cdts.catalog.frequency")}>
            <select
              className="rounded border border-line bg-surface-2 px-2 py-2 text-sm text-ink"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
              aria-label={t("cdts.catalog.frequency")}
            >
              {FREQUENCIES.map((item) => (
                <option key={item} value={item}>
                  {t(`cdts.frequency.${item}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("cdts.catalog.grossYield")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={grossYield}
              onChange={(e) => setGrossYield(e.target.value)}
              inputMode="decimal"
              aria-label={t("cdts.catalog.grossYield")}
            />
          </Field>
          <Field label={t("cdts.catalog.netYield")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={netYield}
              onChange={(e) => setNetYield(e.target.value)}
              inputMode="decimal"
              aria-label={t("cdts.catalog.netYield")}
            />
          </Field>
          <Field label={t("cdts.catalog.withholding")}>
            <input
              className="rounded border border-line px-3 py-2 text-sm text-ink"
              value={withholding}
              onChange={(e) => setWithholding(e.target.value)}
              inputMode="decimal"
              aria-label={t("cdts.catalog.withholding")}
            />
          </Field>
          <label className="flex items-center gap-2 self-end py-2 text-sm text-ink">
            <input type="checkbox" checked={capitalize} onChange={(e) => setCapitalize(e.target.checked)} />
            {t("cdts.catalog.capitalize")}
          </label>
          <button className="w-fit rounded bg-up px-3 py-2 text-sm text-white" type="submit">
            {t("common.add")}
          </button>
        </form>
        <ul className="mt-4 divide-y">
          {deposits.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.kind === "cdt" && editing.id === row.id ? (
                <form onSubmit={(e) => void saveName("cdt", row, e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input
                    className="min-w-[8rem] flex-1 rounded border border-line px-2 py-1"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label={t("common.name")}
                    autoFocus
                    required
                  />
                  <button className="text-sm text-accent underline" type="submit">
                    {t("common.save")}
                  </button>
                  <button className="text-sm text-muted underline" type="button" onClick={cancelEdit}>
                    {t("common.cancel")}
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0">
                    {row.name}{" "}
                    <span className="text-xs text-muted">
                      {row.bank_name} · {row.currency} · {row.annual_rate}% · {row.term_days} ·{" "}
                      {t(`cdts.yieldPayment.${row.yield_payment}`)} · {t(`cdts.frequency.${row.payment_frequency}`)} ·{" "}
                      {t(`cdts.status.${row.status}`)} ·{" "}
                      {row.value == null
                        ? t("cdts.summary.noValue")
                        : formatMoney(Number(row.value), asMoneyCurrency(row.currency))}{" "}
                      · {row.active ? t("common.active") : t("common.inactive")}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="text-sm text-accent underline" onClick={() => startEdit("cdt", row)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void toggleActive(row)}>
                      {row.active ? t("common.inactivate") : t("common.activate")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void remove("cdt", row)}>
                      {t("common.delete")}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
