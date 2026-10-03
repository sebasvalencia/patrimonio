import { FormEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Position, Target, TargetProgress, Variation } from "../api";
import { useCurrency } from "../currency";
import { asMoneyCurrency, convertMoney, formatMoney, formatNumber } from "../format";
import { chartTheme, useTheme } from "../theme";

export type CatalogItem = { id: number; name: string; active: boolean; currency: string };

type Labels = {
  positions: string;
  instrument: string;
  broker: string;
  lastPrice: string;
  noPrice: string;
  pieTitle: string;
  pieEmpty: string;
  variationTitle: string;
  variationEmpty: string;
  targetTitle: string;
  targetPrice: string;
  saveTarget: string;
  targetEmpty: string;
  targetVs: string;
};

type Props = {
  title: string;
  labels: Labels;
  positions: Position[];
  items: CatalogItem[];
  selectedId: number | "";
  onSelect: (id: number) => void;
  variation: Variation | null;
  progress: TargetProgress | null;
  targets: Target[];
  objYear: string;
  objMonth: string;
  objPrice: string;
  onObjYear: (v: string) => void;
  onObjMonth: (v: string) => void;
  onObjPrice: (v: string) => void;
  onSaveTarget: (e: FormEvent) => void;
};

export function useDisplayPositions(positions: Position[]) {
  const { currency, rates } = useCurrency();
  return useMemo(() => {
    return positions.map((p) => {
      const last =
        p.last_price == null
          ? null
          : convertMoney(
              Number(p.last_price),
              asMoneyCurrency(p.instrument_currency),
              currency,
              p.price_year,
              p.price_month,
              rates,
            );
      const value =
        p.value == null
          ? null
          : convertMoney(
              Number(p.value),
              asMoneyCurrency(p.instrument_currency),
              currency,
              p.price_year,
              p.price_month,
              rates,
            );
      return { ...p, lastDisplay: last, valueDisplay: value };
    });
  }, [positions, currency, rates]);
}

export default function PortfolioBlock({
  title,
  labels,
  positions,
  items,
  selectedId,
  onSelect,
  variation,
  progress,
  targets,
  objYear,
  objMonth,
  objPrice,
  onObjYear,
  onObjMonth,
  onObjPrice,
  onSaveTarget,
}: Props) {
  const { t } = useTranslation();
  const { currency, rates } = useCurrency();
  const { theme } = useTheme();
  const CHART = chartTheme(theme);
  const displayPositions = useDisplayPositions(positions);
  const usdReady = displayPositions.filter((p) => p.valueDisplay != null);
  const displayTotal = usdReady.reduce((acc, p) => acc + Number(p.valueDisplay), 0);
  const active = items.filter((i) => i.active);

  const pieData = useMemo(
    () =>
      usdReady
        .filter((p) => Number(p.valueDisplay) > 0)
        .map((p) => ({
          name: `${p.instrument_name} · ${p.broker_name}`,
          value: Number(p.valueDisplay),
        })),
    [usdReady],
  );

  const selectedNative = asMoneyCurrency(
    items.find((i) => i.id === selectedId)?.currency ?? progress?.instrument_currency,
  );

  const marketDisplay =
    progress?.last_price == null
      ? null
      : convertMoney(
          Number(progress.last_price),
          selectedNative,
          currency,
          progress.price_year,
          progress.price_month,
          rates,
        );
  const targetDisplay =
    progress?.target == null
      ? null
      : convertMoney(
          Number(progress.target),
          selectedNative,
          currency,
          progress.target_year,
          progress.target_month,
          rates,
        );

  const barTarget = useMemo(() => {
    if (marketDisplay == null || targetDisplay == null) return [];
    return [
      { name: t("summary.market"), valor: marketDisplay },
      { name: t("summary.target"), valor: targetDisplay },
    ];
  }, [marketDisplay, targetDisplay, t]);

  const pctProgress = progress?.progress_pct == null ? null : Number(progress.progress_pct);
  const barPct = pctProgress == null ? 0 : Math.min(pctProgress, 100);

  const lineData = useMemo(
    () =>
      (variation?.points ?? [])
        .filter((p) => p.variation_pct !== null)
        .map((p) => ({
          periodo: `${p.year}-${String(p.month).padStart(2, "0")}`,
          variacion: Number(p.variation_pct),
        })),
    [variation],
  );

  function moneyOrMissing(n: number | null, fallback: string): string {
    if (n == null) return fallback;
    return formatMoney(n, currency);
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <section className="overflow-x-auto rounded-lg bg-surface p-4 shadow-sm">
        <h3 className="font-display text-xl">{labels.positions}</h3>
        <p className="mt-1 text-sm text-muted">{formatMoney(displayTotal, currency)}</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-2">{labels.instrument}</th>
              <th>{labels.broker}</th>
              <th className="text-right">{t("summary.balance")}</th>
              <th className="text-right">{labels.lastPrice}</th>
              <th className="text-right">{t("summary.value")}</th>
              <th className="text-right">{t("summary.weight")}</th>
            </tr>
          </thead>
          <tbody>
            {displayPositions.map((p) => {
              const weight =
                p.valueDisplay == null || displayTotal === 0
                  ? null
                  : (p.valueDisplay / displayTotal) * 100;
              return (
                <tr key={`${p.instrument_id}-${p.broker_id}`} className="border-b border-line">
                  <td className="py-2">
                    {p.instrument_name}{" "}
                    <span className="text-xs text-muted">{p.instrument_currency}</span>
                  </td>
                  <td>{p.broker_name}</td>
                  <td className="text-right">{formatNumber(Number(p.balance))}</td>
                  <td className="text-right">
                    {p.missing_price ? labels.noPrice : moneyOrMissing(p.lastDisplay, t("fx.missing"))}
                  </td>
                  <td className="text-right">
                    {p.missing_price ? t("common.dash") : moneyOrMissing(p.valueDisplay, t("fx.missing"))}
                  </td>
                  <td className="text-right">
                    {weight == null
                      ? t("common.dash")
                      : `${formatNumber(weight, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg bg-surface p-4 shadow-sm">
          <h3 className="font-display text-xl">{labels.pieTitle}</h3>
          {pieData.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{labels.pieEmpty}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    labelLine={{ stroke: CHART.tick }}
                    label={({ percent }: { percent?: number }) =>
                      `${formatNumber((percent ?? 0) * 100, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}%`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART.colors[i % CHART.colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} {...CHART.tooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="rounded-lg bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xl">{labels.variationTitle}</h3>
            <select
              className="rounded border border-line px-2 py-1 text-sm"
              value={selectedId}
              onChange={(e) => onSelect(Number(e.target.value))}
              disabled={active.length === 0}
            >
              {active.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          {lineData.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{labels.variationEmpty}</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="periodo" tick={{ fill: CHART.tick }} stroke={CHART.grid} />
                  <YAxis unit="%" tick={{ fill: CHART.tick }} stroke={CHART.grid} />
                  <Tooltip {...CHART.tooltip} />
                  <Line type="monotone" dataKey="variacion" stroke={CHART.series} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      <section className="rounded-lg bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl">{labels.targetTitle}</h3>
          <select
            className="rounded border border-line px-2 py-1 text-sm"
            value={selectedId}
            onChange={(e) => onSelect(Number(e.target.value))}
            disabled={active.length === 0}
          >
            {active.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={onSaveTarget} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            {t("common.year")}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              value={objYear}
              onChange={(e) => onObjYear(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            {t("common.month")}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={1}
              max={12}
              value={objMonth}
              onChange={(e) => onObjMonth(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            {labels.targetPrice}
            <input
              className="mt-1 w-full rounded border border-line px-2 py-2"
              type="number"
              min={0.0001}
              step="any"
              value={objPrice}
              onChange={(e) => onObjPrice(e.target.value)}
              required
            />
          </label>
          <div className="flex items-end">
            <button
              className="rounded bg-accent px-4 py-2 text-sm text-white"
              type="submit"
              disabled={selectedId === ""}
            >
              {labels.saveTarget}
            </button>
          </div>
        </form>
        {pctProgress == null ? (
          <p className="mt-4 text-sm text-muted">{labels.targetEmpty}</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm text-muted">{labels.targetVs}</p>
              <p className="font-display text-3xl">{pctProgress.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-muted">
                {moneyOrMissing(marketDisplay, t("fx.missing"))} / {moneyOrMissing(targetDisplay, t("fx.missing"))}
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${barPct}%` }} />
              </div>
            </div>
            {barTarget.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={barTarget}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="name" tick={{ fill: CHART.tick }} stroke={CHART.grid} />
                    <YAxis tick={{ fill: CHART.tick }} stroke={CHART.grid} />
                    <Tooltip formatter={(v: number) => formatMoney(v, currency)} {...CHART.tooltip} />
                    <Bar dataKey="valor" fill={CHART.series} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        {targets.length > 0 && (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2">{t("summary.period")}</th>
                <th className="text-right">{t("summary.target")}</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((o) => {
                const shown = convertMoney(
                  Number(o.price),
                  asMoneyCurrency(o.instrument_currency ?? selectedNative),
                  currency,
                  o.year,
                  o.month,
                  rates,
                );
                return (
                  <tr key={o.id} className="border-b border-line">
                    <td className="py-2">
                      {o.year}-{String(o.month).padStart(2, "0")}
                    </td>
                    <td className="text-right">
                      {shown == null ? t("fx.missing") : formatMoney(shown, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
