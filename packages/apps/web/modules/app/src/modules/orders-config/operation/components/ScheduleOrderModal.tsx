import { useEffect, useMemo, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import { MODALITY_LABELS, type Order } from "../domain/order";
import { Modal } from "./Dialog";

export interface ScheduleOrderModalProps {
  open: boolean;
  orderCode?: string;
  initialIso?: string | null;
  scheduledDates?: string[];
  scheduledOrders?: Order[];
  onViewOrder?: (orderId: string) => void;
  onClose: () => void;
  onConfirm: (isoString: string) => void;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MONTH_NAMES = [
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
];

const TIME_SLOTS: string[] = Array.from({ length: 17 }, (_, idx) => {
  const hour = idx + 6;
  return `${String(hour).padStart(2, "0")}:00`;
});

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultFutureSlot(now: Date): { day: Date; time: string } {
  const nextHour = now.getHours() + 1;
  if (nextHour <= 22) {
    const clamped = Math.max(6, nextHour);
    return {
      day: startOfDay(now),
      time: `${String(clamped).padStart(2, "0")}:00`,
    };
  }
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { day: tomorrow, time: "09:00" };
}

function formatHourShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduleOrderModal({
  open,
  orderCode,
  initialIso,
  scheduledDates = [],
  scheduledOrders = [],
  onViewOrder,
  onClose,
  onConfirm,
}: ScheduleOrderModalProps) {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date>(
    () => defaultFutureSlot(new Date()).day,
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    () => defaultFutureSlot(new Date()).time,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    if (initialIso) {
      const parsed = new Date(initialIso);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
        const day = startOfDay(parsed);
        const hh = Math.min(22, Math.max(6, parsed.getHours()));
        setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
        setSelectedDay(day);
        setSelectedTime(`${String(hh).padStart(2, "0")}:00`);
        setError(null);
        return;
      }
    }
    const def = defaultFutureSlot(now);
    setViewMonth(new Date(def.day.getFullYear(), def.day.getMonth(), 1));
    setSelectedDay(def.day);
    setSelectedTime(def.time);
    setError(null);
  }, [open, initialIso]);

  const scheduledCountsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    const isoList =
      scheduledOrders.length > 0
        ? scheduledOrders
            .map((o) => o.scheduledFor)
            .filter((d): d is string => Boolean(d))
        : scheduledDates;

    for (const iso of isoList) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        const key = dateKey(d);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [scheduledOrders, scheduledDates]);

  const today = startOfDay(new Date());
  const todayKey = dateKey(today);
  const selectedKey = dateKey(selectedDay);

  const selectedDayOrders = useMemo(() => {
    if (scheduledOrders.length === 0) return [];
    return scheduledOrders
      .filter((order) => {
        if (!order.scheduledFor) return false;
        const d = new Date(order.scheduledFor);
        return !Number.isNaN(d.getTime()) && dateKey(d) === selectedKey;
      })
      .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  }, [scheduledOrders, selectedKey]);

  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday-first index (0 = Monday ... 6 = Sunday)
    const offset = (first.getDay() + 6) % 7;

    const cells: Array<Date | null> = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  if (!open) return null;

  const isSlotPast = (slot: string): boolean => {
    const [hh, mm] = slot.split(":").map(Number);
    const candidate = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      hh,
      mm,
      0,
      0,
    );
    return candidate.getTime() <= Date.now();
  };

  const handleSelectDay = (day: Date) => {
    if (day.getTime() < today.getTime()) return;
    setSelectedDay(day);
    setError(null);

    if (dateKey(day) === todayKey) {
      const [hh, mm] = selectedTime.split(":").map(Number);
      const current = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hh,
        mm,
      );
      if (current.getTime() <= Date.now()) {
        const nextValid = TIME_SLOTS.find((slot) => {
          const [sh, sm] = slot.split(":").map(Number);
          return (
            new Date(
              day.getFullYear(),
              day.getMonth(),
              day.getDate(),
              sh,
              sm,
            ).getTime() > Date.now()
          );
        });
        if (nextValid) setSelectedTime(nextValid);
      }
    }
  };

  const handleConfirm = () => {
    const [hh, mm] = selectedTime.split(":").map(Number);
    const target = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      hh,
      mm,
      0,
      0,
    );

    if (target.getTime() <= Date.now()) {
      setError("Selecciona una fecha y hora futura para programar el pedido.");
      return;
    }

    onConfirm(target.toISOString());
  };

  const summaryFormatted = (() => {
    const [hh, mm] = selectedTime.split(":").map(Number);
    const target = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
      hh,
      mm,
    );
    return target.toLocaleString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  const canGoPrevMonth =
    viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() &&
      viewMonth.getMonth() > today.getMonth());

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={orderCode ? `Programar pedido ${orderCode}` : "Programar pedido"}
      className="w-[min(95vw,50rem)] overflow-hidden p-0"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <CalendarDaysIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-title dark:text-white">
                {orderCode ? `Programar pedido ${orderCode}` : "Programar entrega"}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                El pedido pasará automáticamente a Nuevo cuando llegue la hora seleccionada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 md:grid-cols-[1.15fr_1fr]">
          {/* Left: Monthly Calendar */}
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                disabled={!canGoPrevMonth}
                onClick={() =>
                  setViewMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                  )
                }
                aria-label="Mes anterior"
                className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <ChevronLeftIcon className="size-4" />
              </button>

              <span className="text-sm font-bold text-ink-body dark:text-white">
                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>

              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                  )
                }
                aria-label="Mes siguiente"
                className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            {/* 3-letter weekday headers */}
            <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="h-11" />;
                }
                const key = dateKey(cell);
                const isPast = cell.getTime() < today.getTime();
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const scheduledCount = scheduledCountsByDay.get(key) ?? 0;
                const dotCount = Math.min(3, scheduledCount);

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectDay(cell)}
                    title={
                      scheduledCount > 0
                        ? `${scheduledCount} ${scheduledCount === 1 ? "pedido programado" : "pedidos programados"}`
                        : undefined
                    }
                    className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                      isPast
                        ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
                        : isSelected
                          ? "bg-brand-500 text-white shadow-theme-xs cursor-pointer"
                          : isToday
                            ? "border border-brand-300 bg-brand-50/70 text-brand-600 hover:bg-brand-100/70 cursor-pointer dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                            : "text-gray-700 hover:bg-white hover:shadow-theme-xs cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="leading-none">{cell.getDate()}</span>
                    {dotCount > 0 && (
                      <span className="mt-1 flex items-center justify-center gap-0.5">
                        {Array.from({ length: dotCount }).map((_, dotIdx) => (
                          <span
                            key={dotIdx}
                            className={`size-1.5 rounded-full ${
                              isSelected ? "bg-white" : "bg-violet-500 dark:bg-violet-400"
                            }`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-violet-500" />
                <span className="size-1.5 rounded-full bg-violet-500/70" />
              </span>
              <span>Indicadores de pedidos programados por día (hasta 3 puntos)</span>
            </div>
          </div>

          {/* Right: Scheduled orders for selected day + Hourly Time Slots */}
          <div className="flex flex-col gap-3.5 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            {/* Already-scheduled orders for selected day */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-500/20 dark:bg-violet-500/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-violet-800 dark:text-violet-200">
                  Programados el{" "}
                  {selectedDay.toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600/15 px-1.5 text-[10px] font-bold tabular-nums text-violet-700 dark:bg-violet-400/20 dark:text-violet-200">
                  {selectedDayOrders.length}
                </span>
              </div>

              {selectedDayOrders.length === 0 ? (
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  No hay entregas programadas para esta fecha.
                </p>
              ) : (
                <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-0.5 custom-scrollbar">
                  {selectedDayOrders.map((item) => {
                    const clickable = Boolean(onViewOrder);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!clickable}
                        onClick={() => onViewOrder?.(item.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-violet-200/70 bg-white px-2.5 py-1.5 text-left text-[11px] transition-colors dark:border-violet-500/25 dark:bg-gray-900 ${
                          clickable
                            ? "cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-500/15"
                            : "cursor-default"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-violet-700 dark:text-violet-300">
                              {formatHourShort(item.scheduledFor)}
                            </span>
                            <span className="font-mono font-bold text-ink-title dark:text-white">
                              {item.code}
                            </span>
                            <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                              {item.customerName}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                            {MODALITY_LABELS[item.modality]}
                          </div>
                        </div>
                        {clickable && (
                          <ArrowTopRightOnSquareIcon className="size-3.5 shrink-0 text-violet-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hourly slots */}
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <ClockIcon className="size-4 text-brand-500" />
                <span className="text-xs font-bold text-ink-body dark:text-white">
                  Hora de activación (
                  {selectedDay.toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                  })}
                  )
                </span>
              </div>

              <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {TIME_SLOTS.map((slot) => {
                  const disabled = isSlotPast(slot);
                  const active = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedTime(slot);
                        setError(null);
                      }}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition-colors ${
                        disabled
                          ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-700"
                          : active
                            ? "border-brand-500 bg-brand-500 text-white shadow-theme-xs cursor-pointer"
                            : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-25 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/50"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-1">
              <div className="rounded-xl border border-brand-100 bg-brand-25 px-3 py-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">
                  Fecha y hora elegida
                </div>
                <div className="mt-0.5 text-xs font-bold capitalize text-ink-body dark:text-white">
                  {summaryFormatted}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          {error && (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-400">
              <ExclamationTriangleIcon className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm}>
              Confirmar programación
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

export default ScheduleOrderModal;
