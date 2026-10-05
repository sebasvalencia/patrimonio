import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BannerPrecios from "../BannerPrecios";
import {
  api,
  type Fund,
  type FundTarget,
  type FundTargetProgress,
  type FundVariation,
  type Instrument,
  type Target,
  type TargetProgress,
  type Variation,
  type Wealth,
} from "../api";
import { useCurrency } from "../currency";
import { asMoneyCurrency, formatMoney } from "../format";
import PortfolioBlock, { useDisplayPositions } from "./PortfolioBlock";

function asTarget(row: FundTarget): Target {
  return {
    id: row.id,
    instrument_id: row.fund_id,
    year: row.year,
    month: row.month,
    price: row.price,
    instrument_name: row.fund_name,
    instrument_currency: row.fund_currency,
  };
}

function asProgress(row: FundTargetProgress): TargetProgress {
  return {
    instrument_id: row.fund_id,
    instrument_name: row.fund_name,
    last_price: row.last_price,
    price_year: row.price_year,
    price_month: row.price_month,
    target: row.target,
    target_year: row.target_year,
    target_month: row.target_month,
    progress_pct: row.progress_pct,
    instrument_currency: row.fund_currency,
  };
}

function asVariation(row: FundVariation): Variation {
  return {
    instrument_id: row.fund_id,
    instrument_name: row.fund_name,
    instrument_currency: row.fund_currency,
    points: row.points,
  };
}

export default function SummaryPage() {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [wealth, setWealth] = useState<Wealth | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [eqSel, setEqSel] = useState<number | "">("");
  const [fdSel, setFdSel] = useState<number | "">("");
  const [eqVariation, setEqVariation] = useState<Variation | null>(null);
  const [eqProgress, setEqProgress] = useState<TargetProgress | null>(null);
  const [eqTargets, setEqTargets] = useState<Target[]>([]);
  const [fdVariation, setFdVariation] = useState<Variation | null>(null);
  const [fdProgress, setFdProgress] = useState<TargetProgress | null>(null);
  const [fdTargets, setFdTargets] = useState<Target[]>([]);
  const [eqYear, setEqYear] = useState("2026");
  const [eqMonth, setEqMonth] = useState("9");
  const [eqPrice, setEqPrice] = useState("");
  const [fdYear, setFdYear] = useState("2026");
  const [fdMonth, setFdMonth] = useState("9");
  const [fdPrice, setFdPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeEq = useMemo(() => instruments.filter((i) => i.active), [instruments]);
  const activeFd = useMemo(() => funds.filter((i) => i.active), [funds]);
  const eqDisplay = useDisplayPositions(wealth?.equities.positions ?? []);
  const fdDisplay = useDisplayPositions(wealth?.funds.positions ?? []);
  const rsDisplay = useDisplayPositions(wealth?.reserves.positions ?? []);
  const cdtDisplay = useDisplayPositions(wealth?.cdts.positions ?? []);
  const combinedTotal =
    eqDisplay.reduce((acc, p) => acc + Number(p.valueDisplay), 0) +
    fdDisplay.reduce((acc, p) => acc + Number(p.valueDisplay), 0) +
    rsDisplay.reduce((acc, p) => acc + Number(p.valueDisplay), 0) +
    cdtDisplay.reduce((acc, p) => acc + Number(p.valueDisplay), 0);

  useEffect(() => {
    Promise.all([api.wealth(), api.instruments(), api.funds()])
      .then(([w, i, f]) => {
        setWealth(w);
        setInstruments(i);
        setFunds(f);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!activeEq.length) {
      setEqSel("");
      return;
    }
    if (eqSel === "" || !activeEq.some((i) => i.id === eqSel)) setEqSel(activeEq[0].id);
  }, [activeEq, eqSel]);

  useEffect(() => {
    if (!activeFd.length) {
      setFdSel("");
      return;
    }
    if (fdSel === "" || !activeFd.some((i) => i.id === fdSel)) setFdSel(activeFd[0].id);
  }, [activeFd, fdSel]);

  useEffect(() => {
    if (eqSel === "") {
      setEqVariation(null);
      setEqProgress(null);
      setEqTargets([]);
      return;
    }
    Promise.all([api.variation(Number(eqSel)), api.targetProgress(Number(eqSel)), api.targets(Number(eqSel))])
      .then(([v, a, o]) => {
        setEqVariation(v);
        setEqProgress(a);
        setEqTargets(o);
      })
      .catch((e: Error) => setError(e.message));
  }, [eqSel]);

  useEffect(() => {
    if (fdSel === "") {
      setFdVariation(null);
      setFdProgress(null);
      setFdTargets([]);
      return;
    }
    Promise.all([
      api.fundVariation(Number(fdSel)),
      api.fundTargetProgress(Number(fdSel)),
      api.fundTargets(Number(fdSel)),
    ])
      .then(([v, a, o]) => {
        setFdVariation(asVariation(v));
        setFdProgress(asProgress(a));
        setFdTargets(o.map(asTarget));
      })
      .catch((e: Error) => setError(e.message));
  }, [fdSel]);

  async function reloadWealth() {
    const w = await api.wealth();
    setWealth(w);
  }

  async function saveEqTarget(e: FormEvent) {
    e.preventDefault();
    if (eqSel === "") return;
    setError(null);
    try {
      await api.upsertTarget({
        instrument_id: Number(eqSel),
        year: Number(eqYear),
        month: Number(eqMonth),
        price: eqPrice.trim(),
      });
      setEqPrice("");
      const [a, o] = await Promise.all([api.targetProgress(Number(eqSel)), api.targets(Number(eqSel))]);
      setEqProgress(a);
      setEqTargets(o);
      await reloadWealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function saveFdTarget(e: FormEvent) {
    e.preventDefault();
    if (fdSel === "") return;
    setError(null);
    try {
      await api.upsertFundTarget({
        fund_id: Number(fdSel),
        year: Number(fdYear),
        month: Number(fdMonth),
        price: fdPrice.trim(),
      });
      setFdPrice("");
      const [a, o] = await Promise.all([
        api.fundTargetProgress(Number(fdSel)),
        api.fundTargets(Number(fdSel)),
      ]);
      setFdProgress(asProgress(a));
      setFdTargets(o.map(asTarget));
      await reloadWealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const eqNative = instruments.find((i) => i.id === eqSel)?.currency ?? eqProgress?.instrument_currency ?? "COP";
  const fdNative = funds.find((i) => i.id === fdSel)?.currency ?? fdProgress?.instrument_currency ?? "COP";

  return (
    <div className="space-y-8">
      <BannerPrecios linkToPrices kind="both" />
      {error && (
        <p className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</p>
      )}
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-muted">{t("summary.combined")}</p>
        <p className="font-display text-4xl">{formatMoney(combinedTotal, currency)}</p>
      </section>
      <PortfolioBlock
        title={t("summary.equities")}
        labels={{
          positions: t("summary.positions"),
          instrument: t("summary.instrument"),
          broker: t("summary.broker"),
          lastPrice: t("summary.lastPrice"),
          noPrice: t("summary.noPrice"),
          pieTitle: t("summary.pieTitle"),
          pieEmpty: t("summary.pieEmpty"),
          variationTitle: t("summary.variationTitle"),
          variationEmpty: t("summary.variationEmpty"),
          targetTitle: t("summary.targetTitle"),
          targetPrice: t("summary.targetPrice", { currency: eqNative }),
          saveTarget: t("summary.saveTarget"),
          targetEmpty: t("summary.targetEmpty"),
          targetVs: t("summary.targetVs"),
        }}
        positions={wealth?.equities.positions ?? []}
        items={instruments}
        selectedId={eqSel}
        onSelect={setEqSel}
        variation={eqVariation}
        progress={eqProgress}
        targets={eqTargets}
        objYear={eqYear}
        objMonth={eqMonth}
        objPrice={eqPrice}
        onObjYear={setEqYear}
        onObjMonth={setEqMonth}
        onObjPrice={setEqPrice}
        onSaveTarget={saveEqTarget}
      />
      <PortfolioBlock
        title={t("summary.funds")}
        labels={{
          positions: t("funds.summary.positions"),
          instrument: t("funds.summary.fund"),
          broker: t("funds.summary.fiduciary"),
          lastPrice: t("funds.summary.lastValue"),
          noPrice: t("funds.summary.noValue"),
          pieTitle: t("funds.summary.pieTitle"),
          pieEmpty: t("funds.summary.pieEmpty"),
          variationTitle: t("funds.summary.variationTitle"),
          variationEmpty: t("funds.summary.variationEmpty"),
          targetTitle: t("funds.summary.targetTitle"),
          targetPrice: t("funds.summary.targetPrice", { currency: fdNative }),
          saveTarget: t("funds.summary.saveTarget"),
          targetEmpty: t("funds.summary.targetEmpty"),
          targetVs: t("funds.summary.targetVs"),
        }}
        positions={wealth?.funds.positions ?? []}
        items={funds}
        selectedId={fdSel}
        onSelect={setFdSel}
        variation={fdVariation}
        progress={fdProgress}
        targets={fdTargets}
        objYear={fdYear}
        objMonth={fdMonth}
        objPrice={fdPrice}
        onObjYear={setFdYear}
        onObjMonth={setFdMonth}
        onObjPrice={setFdPrice}
        onSaveTarget={saveFdTarget}
      />
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <h2 className="font-display text-xl">{t("reserves.summary.title")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">{t("reserves.summary.account")}</th>
                <th className="py-2 pr-3">{t("reserves.summary.institution")}</th>
                <th className="py-2 pr-3">{t("reserves.summary.purpose")}</th>
                <th className="py-2 pr-3">{t("reserves.summary.liquidity")}</th>
                <th className="py-2 pr-3">{t("reserves.summary.balance")}</th>
                <th className="py-2 pr-3">{t("reserves.summary.year")}</th>
                <th className="py-2">{t("common.month")}</th>
              </tr>
            </thead>
            <tbody>
              {(wealth?.reserves.positions ?? []).map((row) => (
                <tr key={row.instrument_id} className="border-t border-line">
                  <td className="py-2 pr-3">{row.instrument_name}</td>
                  <td className="py-2 pr-3">{row.broker_name}</td>
                  <td className="py-2 pr-3">{t(`reserves.purpose.${row.purpose}`)}</td>
                  <td className="py-2 pr-3">
                    {row.liquid ? t("reserves.summary.liquid") : t("reserves.summary.illiquid")}
                  </td>
                  <td className="py-2 pr-3">
                    {row.value == null
                      ? t("reserves.summary.noBalance")
                      : formatMoney(Number(row.value), asMoneyCurrency(row.instrument_currency))}
                  </td>
                  <td className="py-2 pr-3">{row.price_year ?? "—"}</td>
                  <td className="py-2">
                    {row.price_month == null
                      ? "—"
                      : (t("months.short", { returnObjects: true }) as string[])[row.price_month - 1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <h2 className="font-display text-xl">{t("cdts.summary.title")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">{t("cdts.summary.name")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.bank")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.principal")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.rate")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.opened")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.matures")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.term")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.yieldPayment")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.frequency")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.grossYield")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.netYield")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.withholding")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.capitalize")}</th>
                <th className="py-2 pr-3">{t("cdts.summary.status")}</th>
                <th className="py-2">{t("cdts.summary.value")}</th>
              </tr>
            </thead>
            <tbody>
              {(wealth?.cdts.positions ?? []).map((row) => (
                <tr key={row.instrument_id} className="border-t border-line">
                  <td className="py-2 pr-3">{row.instrument_name}</td>
                  <td className="py-2 pr-3">{row.broker_name}</td>
                  <td className="py-2 pr-3">
                    {formatMoney(Number(row.balance), asMoneyCurrency(row.instrument_currency))}
                  </td>
                  <td className="py-2 pr-3">{row.annual_rate}%</td>
                  <td className="py-2 pr-3">{row.opened_on}</td>
                  <td className="py-2 pr-3">{row.matures_on}</td>
                  <td className="py-2 pr-3">{row.term_days}</td>
                  <td className="py-2 pr-3">{t(`cdts.yieldPayment.${row.yield_payment}`)}</td>
                  <td className="py-2 pr-3">{t(`cdts.frequency.${row.payment_frequency}`)}</td>
                  <td className="py-2 pr-3">
                    {formatMoney(Number(row.gross_yield), asMoneyCurrency(row.instrument_currency))}
                  </td>
                  <td className="py-2 pr-3">
                    {formatMoney(Number(row.net_yield), asMoneyCurrency(row.instrument_currency))}
                  </td>
                  <td className="py-2 pr-3">
                    {formatMoney(Number(row.withholding), asMoneyCurrency(row.instrument_currency))}
                  </td>
                  <td className="py-2 pr-3">{row.capitalize ? t("cdts.catalog.yes") : t("cdts.catalog.no")}</td>
                  <td className="py-2 pr-3">{t(`cdts.status.${row.status}`)}</td>
                  <td className="py-2">
                    {row.value == null
                      ? t("cdts.summary.noValue")
                      : formatMoney(Number(row.value), asMoneyCurrency(row.instrument_currency))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
