import { useEffect, useMemo, useRef, useState } from "react";
import { CalenderIcon, ChevronDownIcon, ChevronLeftIcon, CloseIcon } from "@/icons";
import { cn } from "@/utils";
import {
  detectActivePreset,
  formatDateRangeLabel,
  parseLocalYmd,
  presetToRange,
  toLocalYmd,
  type DatePreset,
  type DateRange,
} from "../domain/analyticsUtils";

export interface CalendarRangeDropdownProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  compact?: boolean;
  align?: "left" | "right";
  placeholder?: string;
}

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todo el historial" },
];

const WEEKDAY_HEADERS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"] as const;

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function buildMonthGrid(year: number, month: number): Array<string | null> {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6

  const cells: Array<string | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toLocalYmd(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function CalendarRangeDropdown({
  value,
  onChange,
  compact = false,
  align = "right",
  placeholder,
}: CalendarRangeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);

  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const initialCursor = useMemo(() => {
    const refYmd = value.end ?? value.start;
    const base = refYmd ? parseLocalYmd(refYmd) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [value.end, value.start]);

  const [viewYear, setViewYear] = useState(initialCursor.year);
  const [viewMonth, setViewMonth] = useState(initialCursor.month);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync draft when opening popover
  const handleToggle = () => {
    if (!open) {
      setDraft(value);
      setSelectingEnd(false);
      setHoverYmd(null);
      const refYmd = value.end ?? value.start;
      const base = refYmd ? parseLocalYmd(refYmd) : new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
    setOpen((prev) => !prev);
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const monthCells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const activeDraftPreset = useMemo(() => detectActivePreset(draft), [draft]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Preset clicks apply & close immediately
  const handlePresetClick = (preset: DatePreset) => {
    const nextRange = presetToRange(preset);
    setDraft(nextRange);
    setSelectingEnd(false);
    setHoverYmd(null);
    const refYmd = nextRange.end ?? nextRange.start;
    if (refYmd) {
      const target = parseLocalYmd(refYmd);
      setViewYear(target.getFullYear());
      setViewMonth(target.getMonth());
    }
    onChange(nextRange);
    setOpen(false);
  };

  const handleDayClick = (ymd: string) => {
    if (!selectingEnd || !draft.start) {
      setDraft({ start: ymd, end: null });
      setSelectingEnd(true);
      setHoverYmd(ymd);
      return;
    }

    const [lo, hi] = draft.start <= ymd ? [draft.start, ymd] : [ymd, draft.start];
    setDraft({ start: lo, end: hi });
    setSelectingEnd(false);
    setHoverYmd(null);
  };

  const handleClear = () => {
    const empty: DateRange = { start: null, end: null };
    setDraft(empty);
    setSelectingEnd(false);
    setHoverYmd(null);
    onChange(empty);
    setOpen(false);
  };

  const handleApply = () => {
    if (draft.start && !draft.end) {
      onChange({ start: draft.start, end: draft.start });
    } else {
      onChange(draft);
    }
    setOpen(false);
  };

  // Compute preview bounds for calendar highlighting
  const previewBounds = useMemo(() => {
    if (!draft.start && !draft.end) return null;
    if (selectingEnd && draft.start) {
      const other = hoverYmd ?? draft.start;
      return draft.start <= other
        ? { lo: draft.start, hi: other }
        : { lo: other, hi: draft.start };
    }
    const lo = draft.start ?? draft.end!;
    const hi = draft.end ?? draft.start!;
    return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
  }, [draft, selectingEnd, hoverYmd]);

  const hasRange = Boolean(value.start || value.end);
  const triggerLabel = hasRange
    ? formatDateRangeLabel(value)
    : (placeholder ?? formatDateRangeLabel(value));

  const draftLabel = formatDateRangeLabel(
    draft.start && !draft.end ? { start: draft.start, end: draft.start } : draft,
  );

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div
        className={cn(
          "inline-flex items-center rounded-lg border border-gray-300 bg-white font-medium text-gray-700 shadow-theme-xs transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
          compact ? "h-9 text-xs" : "h-10 text-sm",
          open && "border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-500",
        )}
      >
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-full items-center gap-2 rounded-l-lg transition-colors hover:bg-gray-50 focus:outline-hidden dark:hover:bg-gray-700/70",
            compact ? "pl-3 pr-2" : "pl-3.5 pr-2.5",
            !hasRange && "rounded-r-lg",
          )}
        >
          <CalenderIcon
            className={cn(
              "shrink-0 text-gray-500 dark:text-gray-400",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
          />
          <span className="max-w-[190px] truncate">{triggerLabel}</span>
          <ChevronDownIcon
            className={cn(
              "shrink-0 text-gray-400 transition-transform duration-150",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
              open && "rotate-180",
            )}
          />
        </button>

        {hasRange && (
          <button
            type="button"
            onClick={handleClear}
            title="Limpiar rango de fechas"
            aria-label="Limpiar rango de fechas"
            className="inline-flex h-full items-center justify-center rounded-r-lg border-l border-gray-200 px-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-700/70 dark:hover:text-white"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Seleccionar rango de fechas"
          className={cn(
            "absolute z-50 mt-2 w-[312px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {/* Presets — click applies & closes immediately */}
          <div className="mb-3.5 grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const isSelected = activeDraftPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Month navigation */}
          <div className="mb-2.5 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
              {MONTH_NAMES_ES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <ChevronLeftIcon className="h-4 w-4 rotate-180" />
            </button>
          </div>

          {/* Weekday labels (2-letter Spanish) */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAY_HEADERS.map((label) => (
              <span
                key={label}
                className="py-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {monthCells.map((ymd, index) => {
              if (!ymd) {
                return <span key={`blank-${index}`} className="h-8" />;
              }

              const dayNumber = Number(ymd.slice(8, 10));
              const isStart = previewBounds?.lo === ymd;
              const isEnd = previewBounds?.hi === ymd;
              const isInRange =
                previewBounds !== null &&
                ymd > previewBounds.lo &&
                ymd < previewBounds.hi;
              const isToday = ymd === todayYmd;

              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => handleDayClick(ymd)}
                  onMouseEnter={() => {
                    if (selectingEnd) setHoverYmd(ymd);
                  }}
                  className={cn(
                    "relative flex h-8 w-full items-center justify-center text-xs font-medium transition-colors",
                    isStart || isEnd
                      ? "rounded-lg bg-brand-500 font-semibold text-white shadow-xs"
                      : isInRange
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                        : "rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                    isToday &&
                      !isStart &&
                      !isEnd &&
                      "ring-1 ring-inset ring-brand-400/70 dark:ring-brand-500/60",
                  )}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>

          {/* Helper note & footer */}
          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              {selectingEnd ? "Elige la fecha final" : draftLabel}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
