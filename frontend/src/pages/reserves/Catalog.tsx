import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Institution, type ReserveAccount, type ReservePurpose } from "../../api";

const PURPOSES: ReservePurpose[] = ["official_pension", "severance", "voluntary_pension", "emergency"];

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function ReservesCatalog() {
  const { t } = useTranslation();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [accounts, setAccounts] = useState<ReserveAccount[]>([]);
  const [institutionName, setInstitutionName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("COP");
  const [purpose, setPurpose] = useState<ReservePurpose>("official_pension");
  const [liquid, setLiquid] = useState(false);
  const [editing, setEditing] = useState<{ kind: "institution" | "account"; id: number } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [homes, rows] = await Promise.all([api.institutions(), api.reserveAccounts()]);
    setInstitutions(homes);
    setAccounts(rows);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(message(err, t("common.error"))));
  }, []);

  useEffect(() => {
    if (!institutions.length) {
      setInstitutionId("");
      return;
    }
    if (!institutions.some((row) => String(row.id) === institutionId)) {
      setInstitutionId(String(institutions[0].id));
    }
  }, [institutions, institutionId]);

  async function addInstitution(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createInstitution(institutionName.trim());
      setInstitutionName("");
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function addAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createReserveAccount({
        name: accountName.trim(),
        institution_id: Number(institutionId),
        currency,
        purpose,
        liquid,
      });
      setAccountName("");
      setCurrency("COP");
      setPurpose("official_pension");
      setLiquid(false);
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function toggleActive(row: ReserveAccount) {
    setError(null);
    try {
      await api.patchReserveAccount(row.id, { active: !row.active });
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function toggleLiquid(row: ReserveAccount) {
    setError(null);
    try {
      await api.patchReserveAccount(row.id, { liquid: !row.liquid });
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  function startEdit(kind: "institution" | "account", row: { id: number; name: string }) {
    setError(null);
    setEditing({ kind, id: row.id });
    setDraftName(row.name);
  }

  function cancelEdit() {
    setEditing(null);
    setDraftName("");
  }

  async function saveName(kind: "institution" | "account", row: { id: number; name: string }, e: FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    if (name === row.name) {
      cancelEdit();
      return;
    }
    setError(null);
    try {
      if (kind === "institution") await api.patchInstitution(row.id, name);
      else await api.patchReserveAccount(row.id, { name });
      cancelEdit();
      await load();
    } catch (err) {
      setError(message(err, t("common.error")));
    }
  }

  async function remove(kind: "institution" | "account", row: { id: number; name: string }) {
    const question =
      kind === "institution"
        ? t("reserves.catalog.confirmDeleteInstitution", { name: row.name })
        : t("reserves.catalog.confirmDeleteAccount", { name: row.name });
    if (!window.confirm(question)) return;
    setError(null);
    try {
      if (kind === "institution") await api.deleteInstitution(row.id);
      else await api.deleteReserveAccount(row.id);
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
        <h2 className="font-display text-xl">{t("reserves.catalog.institutions")}</h2>
        <form onSubmit={addInstitution} className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded border border-line px-3 py-2"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder={t("common.name")}
            aria-label={t("reserves.catalog.institutions")}
            required
          />
          <button className="rounded bg-up px-3 py-2 text-sm text-white" type="submit">
            {t("common.add")}
          </button>
        </form>
        <ul className="mt-4 divide-y">
          {institutions.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.kind === "institution" && editing.id === row.id ? (
                <form onSubmit={(e) => void saveName("institution", row, e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                    <button type="button" className="text-sm text-accent underline" onClick={() => startEdit("institution", row)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void remove("institution", row)}>
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
        <h2 className="font-display text-xl">{t("reserves.catalog.accounts")}</h2>
        <form onSubmit={addAccount} className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[10rem] flex-1 rounded border border-line px-3 py-2"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={t("common.name")}
            aria-label={t("reserves.catalog.accounts")}
            required
          />
          <select
            className="rounded border border-line bg-surface-2 px-2 py-2 text-sm"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            aria-label={t("reserves.catalog.institution")}
            required
          >
            {institutions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-line bg-surface-2 px-2 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "COP" | "USD")}
            aria-label={t("reserves.catalog.currency")}
          >
            <option value="COP">{t("currency.cop")}</option>
            <option value="USD">{t("currency.usd")}</option>
          </select>
          <select
            className="rounded border border-line bg-surface-2 px-2 py-2 text-sm"
            value={purpose}
            onChange={(e) => {
              const next = e.target.value as ReservePurpose;
              setPurpose(next);
              setLiquid(next === "emergency");
            }}
            aria-label={t("reserves.catalog.purpose")}
          >
            {PURPOSES.map((item) => (
              <option key={item} value={item}>
                {t(`reserves.purpose.${item}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={liquid} onChange={(e) => setLiquid(e.target.checked)} />
            {t("reserves.catalog.liquid")}
          </label>
          <button className="rounded bg-up px-3 py-2 text-sm text-white" type="submit">
            {t("common.add")}
          </button>
        </form>
        <ul className="mt-4 divide-y">
          {accounts.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              {editing?.kind === "account" && editing.id === row.id ? (
                <form onSubmit={(e) => void saveName("account", row, e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                      {row.institution_name} · {row.currency} · {t(`reserves.purpose.${row.purpose}`)} ·{" "}
                      {row.liquid ? t("reserves.summary.liquid") : t("reserves.summary.illiquid")} ·{" "}
                      {row.active ? t("common.active") : t("common.inactive")}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="text-sm text-accent underline" onClick={() => startEdit("account", row)}>
                      {t("common.edit")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void toggleActive(row)}>
                      {row.active ? t("common.inactivate") : t("common.activate")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void toggleLiquid(row)}>
                      {row.liquid ? t("reserves.catalog.makeIlliquid") : t("reserves.catalog.makeLiquid")}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void remove("account", row)}>
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
