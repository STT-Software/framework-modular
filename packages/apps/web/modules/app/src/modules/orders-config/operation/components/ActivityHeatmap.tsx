import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Card } from "@/elements/ui/card";
import { cn } from "@/utils";
import type { Order } from "../domain/order";
import {
  buildActivityHeatmap,
  buildActivityHeatmapForRange,
  formatDateRangeLabel,
  formatShortDateEs,
  groupHeatmapByMonth,
  type DateRange,
  type HeatmapDay,
} from "../domain/analyticsUtils";

export interface ActivityHeatmapProps {
  orders: Order[];
  selectedRange: DateRange;
  onSelectRange: (range: DateRange) => void;
}

const SPAN_OPTIONS = [15, 30, 60, 90, 120, 240, 360] as const;
type SpanDays = (typeof SPAN_OPTIONS)[number];

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-gray-100 dark:bg-white/[0.06]",
  1: "bg-brand-100 dark:bg-brand-500/25",
  2: "bg-brand-300 dark:bg-brand-500/50",
  3: "bg-brand-400 dark:bg-brand-500/75",
  4: "bg-brand-500 dark:bg-brand-500",
};

const LEGEND_LEVELS: Array<{
  level: 0 | 1 | 2 | 3 | 4;
  numericLabel: string;
  title: string;
}> = [
  { level: 0, numericLabel: "0", title: "0 pedidos" },
  { level: 1, numericLabel: "1", title: "1 pedido" },
  { level: 2, numericLabel: "2–3", title: "2 a 3 pedidos" },
  { level: 3, numericLabel: "4–5", title: "4 a 5 pedidos" },
  { level: 4, numericLabel: "6+", title: "6 o más pedidos" },
];

export const ActivityHeatmap = observer(function ActivityHeatmap({
  orders,
  selectedRange,
  onSelectRange,
}: ActivityHeatmapProps) {
  const [spanDays, setSpanDays] = useState<SpanDays>(360);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Cancel half-selection on outside click or Escape
  useEffect(() => {
    if (!draftStart) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDraftStart(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraftStart(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [draftStart]);

  const isManualRange = Boolean(selectedRange.start && selectedRange.end);

  const heatmapDays = isManualRange
    ? buildActivityHeatmapForRange(
        orders,
        selectedRange.start!,
        selectedRange.end!,
      )
    : buildActivityHeatmap(orders, spanDays);

  const monthBlocks = groupHeatmapByMonth(heatmapDays);
  const totalOrdersInSpan = heatmapDays.reduce((sum, day) => sum + day.count, 0);
  const totalWeeks = monthBlocks.reduce(
    (sum, block) => sum + block.weeks.length,
    0,
  );

  const effectiveDays = heatmapDays.length || spanDays;

  // Scale cells responsively to container width (28px for <= 30d)
  const layout = (() => {
    const labelW = 30;
    const monthCount = Math.max(1, monthBlocks.length);
    const cellGap =
      effectiveDays <= 30
        ? 6
        : effectiveDays <= 90
          ? 5
          : effectiveDays <= 180
            ? 4
            : 3;
    const minMonthGap =
      effectiveDays <= 30
        ? 20
        : effectiveDays <= 90
          ? 16
          : effectiveDays <= 180
            ? 12
            : 8;
    const maxCell =
      effectiveDays <= 30
        ? 28
        : effectiveDays <= 90
          ? 22
          : effectiveDays <= 180
            ? 16
            : 13;

    if (containerWidth <= 0 || totalWeeks === 0) {
      return { cell: maxCell, cellGap, minMonthGap, labelW };
    }

    const totalGaps =
      Math.max(0, totalWeeks - monthCount) * cellGap +
      Math.max(0, monthCount - 1) * minMonthGap +
      labelW +
      20;
    const availableForCells = Math.max(0, containerWidth - totalGaps);
    const computed = Math.floor(availableForCells / totalWeeks);
    const cell = Math.max(10, Math.min(maxCell, computed));

    return { cell, cellGap, minMonthGap, labelW };
  })();

  const hasSelectedRange = Boolean(selectedRange.start || selectedRange.end);

  // Active highlight window (either draft in progress or committed selectedRange)
  const activeBounds = (() => {
    if (draftStart) {
      const other = hoveredDay?.date ?? draftStart;
      return draftStart <= other
        ? { lo: draftStart, hi: other }
        : { lo: other, hi: draftStart };
    }
    if (!selectedRange.start && !selectedRange.end) return null;
    const lo = selectedRange.start ?? selectedRange.end!;
    const hi = selectedRange.end ?? selectedRange.start!;
    return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
  })();

  const handleDayClick = (day: HeatmapDay) => {
    if (!draftStart) {
      if (
        selectedRange.start === day.date &&
        selectedRange.end === day.date
      ) {
        onSelectRange({ start: null, end: null });
        return;
      }
      setDraftStart(day.date);
      return;
    }

    const [lo, hi] =
      draftStart <= day.date ? [draftStart, day.date] : [day.date, draftStart];
    setDraftStart(null);
    onSelectRange({ start: lo, end: hi });
  };

  const handleClearSelection = () => {
    setDraftStart(null);
    onSelectRange({ start: null, end: null });
  };

  const tooltipText = hoveredDay
    ? `${formatShortDateEs(hoveredDay.date, true)} · ${hoveredDay.count} ${
        hoveredDay.count === 1 ? "pedido" : "pedidos"
      }`
    : null;

  return (
    <Card className="p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Actividad diaria
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {totalOrdersInSpan}{" "}
              {totalOrdersInSpan === 1 ? "pedido" : "pedidos"} en{" "}
              {effectiveDays} {effectiveDays === 1 ? "día" : "días"}
            </span>
            {hasSelectedRange && (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                Rango: {formatDateRangeLabel(selectedRange)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {draftStart
              ? `Inicio seleccionado (${formatShortDateEs(draftStart, true)}). Haz clic en otro día para cerrar el rango.`
              : tooltipText
                ? tooltipText
                : "Haz clic en dos días para filtrar el historial por ese rango."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(hasSelectedRange || draftStart) && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
            >
              Limpiar selección
            </button>
          )}

          {/* Span selector — hidden while manual range drives the grid */}
          {!isManualRange && (
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="sr-only">Ventana de días del mapa de actividad</span>
              <select
                aria-label="Rango de días del mapa de actividad"
                value={spanDays}
                onChange={(e) =>
                  setSpanDays(Number(e.target.value) as SpanDays)
                }
                className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-2xs transition-colors focus:border-brand-400 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {SPAN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Últimos {option} días
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Numeric intensity legend */}
          <div className="flex items-center gap-2">
            {LEGEND_LEVELS.map((item) => (
              <span
                key={item.level}
                title={item.title}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400"
              >
                <span
                  className={cn(
                    "h-3 w-3 rounded-[3px]",
                    LEVEL_CLASSES[item.level],
                  )}
                />
                <span>{item.numericLabel}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto pb-1"
        onMouseLeave={() => setHoveredDay(null)}
      >
        <div className="flex min-w-fit items-start gap-3">
          {/* Weekday labels column */}
          <div
            className="flex shrink-0 flex-col"
            style={{ gap: `${layout.cellGap}px`, width: `${layout.labelW}px` }}
          >
            {WEEKDAY_LABELS.map((dayLabel) => (
              <span
                key={dayLabel}
                className="flex items-center text-[10px] font-medium text-gray-400 dark:text-gray-500"
                style={{ height: `${layout.cell}px` }}
              >
                {dayLabel}
              </span>
            ))}
          </div>

          {/* Month blocks */}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-start",
              monthBlocks.length > 1 ? "justify-between" : "justify-start",
            )}
            style={{ gap: `${layout.minMonthGap}px` }}
          >
            {monthBlocks.map((month) => (
              <div
                key={month.key}
                className="flex shrink-0 flex-col items-center"
              >
                <div className="flex" style={{ gap: `${layout.cellGap}px` }}>
                  {month.weeks.map((week, weekIdx) => (
                    <div
                      key={`${month.key}-w${weekIdx}`}
                      className="flex flex-col"
                      style={{ gap: `${layout.cellGap}px` }}
                    >
                      {week.map((cell, rowIdx) => {
                        if (!cell) {
                          return (
                            <span
                              key={`empty-${rowIdx}`}
                              style={{
                                width: layout.cell,
                                height: layout.cell,
                              }}
                              className="rounded-[3px] bg-transparent"
                            />
                          );
                        }

                        const inRange =
                          activeBounds !== null &&
                          cell.date >= activeBounds.lo &&
                          cell.date <= activeBounds.hi;
                        const isEndpoint =
                          activeBounds !== null &&
                          (cell.date === activeBounds.lo ||
                            cell.date === activeBounds.hi);
                        const isDimmed = activeBounds !== null && !inRange;

                        const cellTitle = `${formatShortDateEs(cell.date, true)} · ${
                          cell.count
                        } ${cell.count === 1 ? "pedido" : "pedidos"}`;

                        return (
                          <button
                            key={cell.date}
                            type="button"
                            onClick={() => handleDayClick(cell)}
                            onMouseEnter={() => setHoveredDay(cell)}
                            onFocus={() => setHoveredDay(cell)}
                            title={cellTitle}
                            aria-label={cellTitle}
                            style={{ width: layout.cell, height: layout.cell }}
                            className={cn(
                              "rounded-[3px] transition-all duration-100 hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-brand-500",
                              LEVEL_CLASSES[cell.level],
                              isDimmed && "opacity-30",
                              isEndpoint &&
                                "ring-2 ring-brand-600 ring-offset-1 ring-offset-white dark:ring-brand-400 dark:ring-offset-gray-900",
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <span className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {month.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
});
