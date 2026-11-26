import { useCallback, useState } from "react";
import { observer } from "mobx-react-lite";
import { useSearchParams } from "react-router";
import type { ApexOptions } from "apexcharts";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { PageMeta } from "@/shell/meta";
import {
  ArrowRightIcon,
  DownloadIcon,
  GridIcon,
  TaskIcon,
} from "@/icons";
import { cn } from "@/utils";
import { formatCOP, type Order } from "../domain/order";
import {
  buildAnalyticsCsv,
  computeAnalyticsKPIs,
  computeChannelBreakdown,
  computeDailyStackedStatusSeries,
  computeDailyVolumeSeries,
  computeModalityBreakdown,
  computePaymentStatusStats,
  detectActivePreset,
  downloadCsvFile,
  filterOrdersByRange,
  formatDateRangeLabel,
  presetToRange,
  toLocalYmd,
  type BreakdownItem,
  type DatePreset,
  type DateRange,
} from "../domain/analyticsUtils";
import { AnalyticsChart } from "../components/AnalyticsChart";
import { CalendarRangeDropdown } from "../components/CalendarRangeDropdown";
import { HistoryTab } from "../components/HistoryTab";

export interface AnalyticsPageProps {
  orders: Order[];
  enabledModalities?: ReadonlyArray<string>;
  hasConversation?: (phone: string) => boolean;
  onOpenOrderDetail?: (order: Order) => void;
  onOpenChat?: (order: Order) => void;
}

const QUICK_PILLS: Array<{ id: DatePreset; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "30d", label: "30 días" },
  { id: "7d", label: "7 días" },
];

function BreakdownCard({
  title,
  subtitle,
  items,
  totalOrders,
  onViewInHistory,
  onSelectItem,
}: {
  title: string;
  subtitle: string;
  items: BreakdownItem[];
  totalOrders: number;
  onViewInHistory: () => void;
  onSelectItem: (id: string) => void;
}) {
  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"}
          </span>
        </div>

        {totalOrders === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            Sin datos en este periodo
          </div>
        ) : (
          <div className="space-y-3.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className="group block w-full rounded-xl p-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-gray-800 group-hover:text-brand-600 dark:text-gray-200 dark:group-hover:text-brand-400">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <strong className="font-semibold text-gray-900 dark:text-white">
                      {item.count}
                    </strong>
                    <span className="w-9 text-right font-semibold text-gray-500 dark:text-gray-400">
                      {item.percentage}%
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-3.5 dark:border-gray-800">
        <button
          type="button"
          onClick={onViewInHistory}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:text-brand-400"
        >
          <span>Ver pedidos en historial</span>
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

export const AnalyticsPage = observer(function AnalyticsPage({
  orders,
  enabledModalities,
  hasConversation,
  onOpenOrderDetail,
  onOpenChat,
}: AnalyticsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const vistaParam = searchParams.get("vista");
  const activeTab: "metrics" | "history" =
    vistaParam === "historial" || vistaParam === "lista"
      ? "history"
      : "metrics";

  // Default initial range preset to "7d" (StockFlow parity)
  const [range, setRange] = useState<DateRange>(() => presetToRange("7d"));
  const [historyChannel, setHistoryChannel] = useState<string | null>(null);
  const [historyModality, setHistoryModality] = useState<string | null>(null);
  const [historyExportOrders, setHistoryExportOrders] = useState<
    Order[] | null
  >(null);

  const handleHistoryFilteredChange = useCallback((nextOrders: Order[]) => {
    setHistoryExportOrders(nextOrders);
  }, []);

  const setActiveTab = (tab: "metrics" | "history") => {
    const next = new URLSearchParams(searchParams);
    if (tab === "history") {
      next.set("vista", "historial");
    } else {
      next.delete("vista");
    }
    setSearchParams(next, { replace: true });
  };

  const navigateToHistoryWith = (opts: {
    channel?: string | null;
    modality?: string | null;
  }) => {
    setHistoryChannel(opts.channel ?? null);
    setHistoryModality(opts.modality ?? null);
    setActiveTab("history");
  };

  // Compute directly inside observer render so MobX ObservableArray mutations update immediately
  const activePreset = detectActivePreset(range);
  const isAllHistory = activePreset === "all";

  const filteredOrders = filterOrdersByRange(orders, range);
  const kpis = computeAnalyticsKPIs(filteredOrders);
  const dailyVolume = computeDailyVolumeSeries(filteredOrders, range);
  const channelBreakdown = computeChannelBreakdown(filteredOrders);
  const modalityBreakdown = computeModalityBreakdown(filteredOrders);
  const stackedStatus = computeDailyStackedStatusSeries(filteredOrders, range);
  const paymentStats = computePaymentStatusStats(filteredOrders);

  // Fallback closed orders in current range if HistoryTab callback hasn't populated yet
  const fallbackHistoryClosedOrders = filterOrdersByRange(
    orders.filter(
      (order) => order.stage === "delivered" || order.stage === "cancelled",
    ),
    range,
    (order) => order.deliveredAt ?? order.createdAt,
  );

  const csvOrders =
    activeTab === "history"
      ? (historyExportOrders ?? fallbackHistoryClosedOrders)
      : filteredOrders;

  const handleDownloadCsv = () => {
    const csv = buildAnalyticsCsv(csvOrders);
    const prefix =
      activeTab === "history" ? "historial-pedidos" : "analitica-pedidos";
    downloadCsvFile(`${prefix}-${toLocalYmd(new Date())}.csv`, csv);
  };

  // Chart 1 — Daily volume bar options
  const dailyVolumeOptions: ApexOptions = {
    colors: ["#FF3F1A"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        borderRadiusApplication: "end",
        columnWidth: dailyVolume.length > 20 ? "62%" : "42%",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: dailyVolume.map((pt) => pt.label),
      labels: {
        rotate: -35,
        hideOverlappingLabels: true,
      },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: {
        formatter: (val) => String(Math.round(val)),
      },
    },
    grid: {
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      custom: ({ dataPointIndex }) => {
        const point = dailyVolume[dataPointIndex];
        if (!point) return "";
        const countLabel = `${point.count} ${
          point.count === 1 ? "pedido" : "pedidos"
        }`;
        return `<div class="px-3 py-2 text-xs">
            <div class="font-semibold mb-0.5">${point.label}</div>
            <div>${countLabel}</div>
            ${
              point.revenue > 0
                ? `<div class="mt-0.5 opacity-80">Ventas: ${formatCOP(point.revenue)}</div>`
                : ""
            }
          </div>`;
      },
    },
  };

  const dailyVolumeSeries = [
    {
      name: "Pedidos",
      data: dailyVolume.map((pt) => pt.count),
    },
  ];

  // Chart 2 — Stacked status bar options
  const stackedStatusOptions: ApexOptions = {
    chart: { stacked: true },
    colors: stackedStatus.series.map((s) => s.color),
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: stackedStatus.categories.length > 20 ? "62%" : "46%",
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: stackedStatus.categories,
      labels: {
        rotate: -35,
        hideOverlappingLabels: true,
      },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: {
        formatter: (val) => String(Math.round(val)),
      },
    },
    grid: {
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => `${val} ${val === 1 ? "pedido" : "pedidos"}`,
      },
    },
  };

  const stackedStatusSeries = stackedStatus.series.map((s) => ({
    name: s.name,
    data: s.data,
  }));

  // Chart 3 — Payment status donut (StockFlow aligned: Necto palette, 74% donut, no central total, horizontal legend below)
  const paymentTotalCount = paymentStats.paidCount + paymentStats.pendingCount;
  const paymentDonutSeries = [
    paymentStats.paidCount,
    paymentStats.pendingCount,
  ];

  const paymentDonutOptions: ApexOptions = {
    labels: ["Pagado", "Pendiente de pago"],
    colors: ["#6ba9b5", "#ff3f1a"],
    stroke: { width: 0 },
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "74%",
          labels: {
            show: false,
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (val) => `${val} ${val === 1 ? "pedido" : "pedidos"}`,
      },
    },
  };

  const kpiCards = [
    {
      label: "Pedidos del periodo",
      value: String(kpis.totalOrders),
      note: formatDateRangeLabel(range),
      accent: "text-gray-900 dark:text-white",
    },
    {
      label: "Ingresos vendidos",
      value: formatCOP(kpis.revenue),
      note: `${kpis.soldOrders} ${
        kpis.soldOrders === 1 ? "pedido vendido" : "pedidos vendidos"
      }`,
      accent: "text-[#538690] dark:text-[#6ba9b5]",
    },
    {
      label: "Ticket promedio",
      value: formatCOP(kpis.averageTicket),
      note: "Promedio por pedido vendido",
      accent: "text-gray-900 dark:text-white",
    },
    {
      label: "Tasa de cancelación",
      value: `${kpis.cancellationRate}%`,
      note: `${kpis.cancelledCount} ${
        kpis.cancelledCount === 1 ? "cancelado" : "cancelados"
      }`,
      accent:
        kpis.cancellationRate > 15
          ? "text-[#ff3f1a] dark:text-[#fe674a]"
          : "text-gray-900 dark:text-white",
    },
    {
      label: "Tiempo de ciclo promedio",
      value:
        kpis.averageCycleMinutes !== null
          ? `${kpis.averageCycleMinutes} min`
          : "—",
      note: "Desde creación hasta entrega",
      accent: "text-gray-900 dark:text-white",
    },
  ];

  const hasVolumeActivity = dailyVolume.some((pt) => pt.count > 0);

  return (
    <div className="space-y-6">
      <PageMeta
        title="Necto · Analítica de pedidos"
        description="Consulta el comportamiento de tus pedidos, ingresos y el historial de cierre."
      />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Analítica de pedidos
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consulta el comportamiento de tus pedidos, ingresos y el historial de cierre.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab switcher synced with ?vista=historial / ?vista=lista */}
          <div
            role="tablist"
            aria-label="Vistas de analítica"
            className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "metrics"}
              onClick={() => setActiveTab("metrics")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
                activeTab === "metrics"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              <GridIcon className="h-4 w-4" />
              Métricas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
                activeTab === "history"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              <TaskIcon className="h-4 w-4" />
              Historial
            </button>
          </div>

          <CalendarRangeDropdown
            value={range}
            onChange={setRange}
            align="right"
          />

          <Button
            variant="outline"
            size="md"
            startIcon={<DownloadIcon className="h-4 w-4" />}
            onClick={handleDownloadCsv}
            disabled={csvOrders.length === 0}
          >
            Descargar CSV
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "history" ? (
        <HistoryTab
          orders={orders}
          initialRange={range}
          initialChannel={historyChannel}
          initialModality={historyModality}
          enabledModalities={enabledModalities}
          hasConversation={hasConversation}
          onRangeChange={setRange}
          onFilteredOrdersChange={handleHistoryFilteredChange}
          onOpenOrderDetail={onOpenOrderDetail}
          onOpenChat={onOpenChat}
        />
      ) : (
        <div className="space-y-6">
          {/* 5 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpiCards.map((card) => (
              <Card
                key={card.label}
                className="flex flex-col justify-between p-4 sm:p-5"
              >
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {card.label}
                </span>
                <strong
                  className={cn(
                    "mt-2 block text-2xl font-bold tracking-tight",
                    card.accent,
                  )}
                >
                  {card.value}
                </strong>
                <span className="mt-1.5 block truncate text-xs text-gray-400 dark:text-gray-500">
                  {card.note}
                </span>
              </Card>
            ))}
          </div>

          {/* Chart 1 — Pedidos por día */}
          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Pedidos por día
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Volumen diario de pedidos creados ·{" "}
                  {formatDateRangeLabel(range)}
                  {isAllHistory ? " · gráficos: últimos 30 días" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Atajos de periodo"
                  className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
                >
                  {QUICK_PILLS.map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setRange(presetToRange(pill.id))}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        activePreset === pill.id
                          ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                          : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                      )}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                <CalendarRangeDropdown
                  value={range}
                  onChange={setRange}
                  compact
                  align="right"
                  placeholder="Calendario"
                />
              </div>
            </div>

            <AnalyticsChart
              type="bar"
              height={290}
              series={dailyVolumeSeries}
              options={dailyVolumeOptions}
              empty={!hasVolumeActivity}
              emptyTitle="Sin datos en este periodo"
              emptyDescription="No se registraron pedidos dentro del rango de fechas seleccionado."
            />
          </Card>

          {/* 2-Column Breakdown Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="¿Cómo llegan tus pedidos?"
              subtitle="Distribución de pedidos por canal de ingreso"
              items={channelBreakdown}
              totalOrders={filteredOrders.length}
              onViewInHistory={() =>
                navigateToHistoryWith({ channel: null, modality: null })
              }
              onSelectItem={(channelId) =>
                navigateToHistoryWith({ channel: channelId, modality: null })
              }
            />

            <BreakdownCard
              title="¿Cómo se entregan?"
              subtitle="Distribución de pedidos según la modalidad de entrega"
              items={modalityBreakdown}
              totalOrders={filteredOrders.length}
              onViewInHistory={() =>
                navigateToHistoryWith({ channel: null, modality: null })
              }
              onSelectItem={(modalityId) =>
                navigateToHistoryWith({ channel: null, modality: modalityId })
              }
            />
          </div>

          {/* Asymmetric Bottom Grid (StockFlow parity: 7 + 5 cols) */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Chart 2 — Pedidos por estado (7 cols) */}
            <Card className="p-5 xl:col-span-7">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Pedidos por estado
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Composición diaria según la etapa actual de cada pedido
                  {isAllHistory ? " · gráficos: últimos 30 días" : ""}
                </p>
              </div>

              <AnalyticsChart
                type="bar"
                height={265}
                series={stackedStatusSeries}
                options={stackedStatusOptions}
                empty={stackedStatus.series.length === 0}
                emptyTitle="Sin datos en este periodo"
                emptyDescription="No hay pedidos clasificados por estado en este rango."
              />

              {stackedStatus.series.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3.5 dark:border-gray-800">
                  {stackedStatus.series.map((stage) => (
                    <span
                      key={stage.name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/[0.04] dark:text-gray-300"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                      <strong className="ml-0.5 font-semibold text-gray-900 dark:text-white">
                        {stage.total}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Chart 3 — Estado de pago (5 cols) */}
            <Card className="flex flex-col justify-between p-5 xl:col-span-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Estado de pago
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Proporción entre pedidos pagados y pendientes de pago (excluye cancelados)
                </p>
              </div>

              <div className="flex flex-1 flex-col items-center justify-between gap-5">
                <div className="w-full max-w-[240px]">
                  <AnalyticsChart
                    type="donut"
                    height={220}
                    series={paymentDonutSeries}
                    options={paymentDonutOptions}
                    empty={paymentTotalCount === 0}
                    emptyTitle="Sin datos en este periodo"
                    emptyDescription="No hay pedidos facturables en el periodo seleccionado."
                  />
                </div>

                {/* Clean horizontal legend below with counts, percentages & totals */}
                <div className="grid w-full grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: "#6ba9b5" }}
                        />
                        Pagado
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: "#538690" }}
                      >
                        {paymentStats.paidPercent}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatCOP(paymentStats.paidAmount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {paymentStats.paidCount}{" "}
                      {paymentStats.paidCount === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: "#ff3f1a" }}
                        />
                        Pendiente de pago
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: "#ff3f1a" }}
                      >
                        {paymentStats.pendingPercent}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatCOP(paymentStats.pendingAmount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {paymentStats.pendingCount}{" "}
                      {paymentStats.pendingCount === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
});
