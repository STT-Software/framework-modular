import {
  CHANNEL_LABELS,
  MODALITY_LABELS,
  PAYMENT_METHOD_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  type Order,
  type OrderChannel,
  type OrderModality,
} from "./order";

// ---------------------------------------------------------------------------
// Date range types & helpers
// ---------------------------------------------------------------------------

export interface DateRange {
  start: string | null;
  end: string | null;
}

export type DatePreset = "7d" | "30d" | "month" | "all";

const SHORT_MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const CAPITALIZED_MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export function toLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isoToLocalYmd(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return toLocalYmd(date);
}

export function addDaysYmd(ymd: string, delta: number): string {
  const date = parseLocalYmd(ymd);
  date.setDate(date.getDate() + delta);
  return toLocalYmd(date);
}

export function formatShortDateEs(ymd: string, includeYear = true): string {
  const date = parseLocalYmd(ymd);
  const day = date.getDate();
  const month = SHORT_MONTHS_ES[date.getMonth()] ?? "";
  return includeYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

export function presetToRange(preset: DatePreset, now: Date = new Date()): DateRange {
  if (preset === "all") {
    return { start: null, end: null };
  }

  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = toLocalYmd(endDate);

  if (preset === "7d") {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    return { start: toLocalYmd(startDate), end };
  }

  if (preset === "30d") {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29);
    return { start: toLocalYmd(startDate), end };
  }

  // "month": first day of current month through today
  const monthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  return { start: toLocalYmd(monthStart), end };
}

export function detectActivePreset(
  range: DateRange,
  now: Date = new Date(),
): DatePreset | null {
  if (!range.start && !range.end) return "all";
  const presets: DatePreset[] = ["7d", "30d", "month"];
  for (const preset of presets) {
    const candidate = presetToRange(preset, now);
    if (candidate.start === range.start && candidate.end === range.end) {
      return preset;
    }
  }
  return null;
}

export function filterOrdersByRange(
  orders: Order[],
  range: DateRange,
  getDate: (order: Order) => string = (order) => order.createdAt,
): Order[] {
  if (!range.start && !range.end) return orders;

  let lo = range.start;
  let hi = range.end;
  if (lo && hi && lo > hi) {
    [lo, hi] = [hi, lo];
  }

  return orders.filter((order) => {
    const ymd = isoToLocalYmd(getDate(order));
    if (lo && ymd < lo) return false;
    if (hi && ymd > hi) return false;
    return true;
  });
}

export function formatDateRangeLabel(range: DateRange): string {
  if (!range.start && !range.end) return "Todo el historial";
  if (range.start && !range.end) return `Desde ${formatShortDateEs(range.start)}`;
  if (!range.start && range.end) return `Hasta ${formatShortDateEs(range.end)}`;

  const start = range.start!;
  const end = range.end!;
  const [lo, hi] = start <= end ? [start, end] : [end, start];

  if (lo === hi) return formatShortDateEs(lo);

  const sameYear = lo.slice(0, 4) === hi.slice(0, 4);
  if (sameYear) {
    return `${formatShortDateEs(lo, false)} – ${formatShortDateEs(hi, true)}`;
  }
  return `${formatShortDateEs(lo, true)} – ${formatShortDateEs(hi, true)}`;
}

// ---------------------------------------------------------------------------
// Metrics & KPIs
// ---------------------------------------------------------------------------

export interface AnalyticsKPIs {
  totalOrders: number;
  soldOrders: number;
  revenue: number;
  averageTicket: number;
  cancelledCount: number;
  cancellationRate: number;
  averageCycleMinutes: number | null;
}

export function computeAnalyticsKPIs(orders: Order[]): AnalyticsKPIs {
  const totalOrders = orders.length;
  const soldList = orders.filter(
    (order) => order.stage !== "new" && order.stage !== "cancelled",
  );
  const soldOrders = soldList.length;
  const revenue = soldList.reduce((sum, order) => sum + order.total, 0);
  const averageTicket = soldOrders > 0 ? Math.round(revenue / soldOrders) : 0;

  const cancelledCount = orders.filter((order) => order.stage === "cancelled").length;
  const cancellationRate =
    totalOrders > 0 ? Math.round((cancelledCount / totalOrders) * 1000) / 10 : 0;

  let cycleSumMinutes = 0;
  let cycleValidCount = 0;
  for (const order of orders) {
    if (order.stage !== "delivered" || !order.deliveredAt) continue;
    const createdMs = new Date(order.createdAt).getTime();
    const deliveredMs = new Date(order.deliveredAt).getTime();
    if (Number.isNaN(createdMs) || Number.isNaN(deliveredMs) || deliveredMs < createdMs) {
      continue;
    }
    cycleSumMinutes += (deliveredMs - createdMs) / 60_000;
    cycleValidCount += 1;
  }

  const averageCycleMinutes =
    cycleValidCount > 0 ? Math.round(cycleSumMinutes / cycleValidCount) : null;

  return {
    totalOrders,
    soldOrders,
    revenue,
    averageTicket,
    cancelledCount,
    cancellationRate,
    averageCycleMinutes,
  };
}

// ---------------------------------------------------------------------------
// Charts & Breakdowns
// ---------------------------------------------------------------------------

export interface DailySeriesPoint {
  date: string;
  label: string;
  count: number;
  revenue: number;
}

function resolveDayBounds(
  orders: Order[],
  range: DateRange,
  maxDaysForAll = 30,
): { start: string; end: string } | null {
  let start = range.start;
  let end = range.end;

  if (start && end && start > end) {
    [start, end] = [end, start];
  }

  if (!start && !end) {
    if (orders.length === 0) return null;
    const todayYmd = toLocalYmd(new Date());
    let maxYmd = isoToLocalYmd(orders[0].createdAt);
    for (let i = 1; i < orders.length; i += 1) {
      const ymd = isoToLocalYmd(orders[i].createdAt);
      if (ymd > maxYmd) maxYmd = ymd;
    }
    const cappedEnd = maxYmd > todayYmd ? maxYmd : todayYmd;
    const cappedStart = addDaysYmd(cappedEnd, -(Math.max(1, maxDaysForAll) - 1));
    return { start: cappedStart, end: cappedEnd };
  }

  if (!start || !end) {
    if (orders.length === 0) {
      if (start && !end) return { start, end: toLocalYmd(new Date()) };
      if (!start && end) return { start: addDaysYmd(end, -6), end };
      return null;
    }

    let minYmd = isoToLocalYmd(orders[0].createdAt);
    let maxYmd = minYmd;
    for (let i = 1; i < orders.length; i += 1) {
      const ymd = isoToLocalYmd(orders[i].createdAt);
      if (ymd < minYmd) minYmd = ymd;
      if (ymd > maxYmd) maxYmd = ymd;
    }

    start = start ?? minYmd;
    end = end ?? maxYmd;
    if (start > end) {
      [start, end] = [end, start];
    }
  }

  // Cap window to 366 days so charts stay crisp and fast
  const startDate = parseLocalYmd(start);
  const endDate = parseLocalYmd(end);
  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  if (diffDays > 365) {
    start = addDaysYmd(end, -365);
  }

  return { start, end };
}

function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = parseLocalYmd(start);
  const limit = parseLocalYmd(end);
  let guard = 0;

  while (cursor.getTime() <= limit.getTime() && guard < 400) {
    days.push(toLocalYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return days;
}

export function computeDailyVolumeSeries(
  orders: Order[],
  range: DateRange,
): DailySeriesPoint[] {
  const bounds = resolveDayBounds(orders, range);
  if (!bounds) return [];

  const counts = new Map<string, number>();
  const revenues = new Map<string, number>();

  for (const order of orders) {
    const ymd = isoToLocalYmd(order.createdAt);
    counts.set(ymd, (counts.get(ymd) ?? 0) + 1);
    if (order.stage !== "new" && order.stage !== "cancelled") {
      revenues.set(ymd, (revenues.get(ymd) ?? 0) + order.total);
    }
  }

  const days = enumerateDays(bounds.start, bounds.end);
  return days.map((date) => ({
    date,
    label: formatShortDateEs(date, false),
    count: counts.get(date) ?? 0,
    revenue: revenues.get(date) ?? 0,
  }));
}

export interface StackedStatusSeriesItem {
  name: string;
  color: string;
  data: number[];
  total: number;
}

export interface StackedStatusSeries {
  categories: string[];
  series: StackedStatusSeriesItem[];
}

const NECTO_STAGE_COLORS: Record<string, string> = {
  new: "#5120dc",
  confirmed: "#6ba9b5",
  preparing: "#fe674a",
  ready: "#538690",
  in_transit: "#ff3f1a",
  delivered: "#10B981",
  cancelled: "#94A3B8",
};

const CANONICAL_STAGE_ORDER = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export function computeDailyStackedStatusSeries(
  orders: Order[],
  range: DateRange,
): StackedStatusSeries {
  const bounds = resolveDayBounds(orders, range);
  if (!bounds || orders.length === 0) {
    return { categories: [], series: [] };
  }

  const days = enumerateDays(bounds.start, bounds.end);
  const dayIndex = new Map<string, number>();
  days.forEach((day, idx) => dayIndex.set(day, idx));

  const stageCounts = new Map<string, number[]>();
  const stageTotals = new Map<string, number>();

  for (const order of orders) {
    const ymd = isoToLocalYmd(order.createdAt);
    const idx = dayIndex.get(ymd);
    if (idx === undefined) continue;

    let bucket = stageCounts.get(order.stage);
    if (!bucket) {
      bucket = new Array<number>(days.length).fill(0);
      stageCounts.set(order.stage, bucket);
    }
    bucket[idx] += 1;
    stageTotals.set(order.stage, (stageTotals.get(order.stage) ?? 0) + 1);
  }

  const orderedStages: string[] = [];
  for (const stage of CANONICAL_STAGE_ORDER) {
    if ((stageTotals.get(stage) ?? 0) > 0) {
      orderedStages.push(stage);
    }
  }
  for (const stage of stageTotals.keys()) {
    if (!orderedStages.includes(stage) && (stageTotals.get(stage) ?? 0) > 0) {
      orderedStages.push(stage);
    }
  }

  const categories = days.map((date) => formatShortDateEs(date, false));
  const series: StackedStatusSeriesItem[] = orderedStages.map((stage) => ({
    name: STAGE_LABELS[stage] ?? stage,
    color: NECTO_STAGE_COLORS[stage] ?? STAGE_COLORS[stage] ?? "#538690",
    data: stageCounts.get(stage) ?? new Array<number>(days.length).fill(0),
    total: stageTotals.get(stage) ?? 0,
  }));

  return { categories, series };
}

export interface BreakdownItem {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Largest-remainder rounding so percentages always sum to exactly 100 when
 * total > 0 (and all 0 when total === 0).
 */
function largestRemainderPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((count) => (count / total) * 100);
  const floored = exact.map((val) => Math.floor(val));
  let remainder = 100 - floored.reduce((sum, n) => sum + n, 0);

  const order = exact
    .map((val, idx) => ({ idx, frac: val - floored[idx], count: counts[idx] }))
    .sort((a, b) => b.frac - a.frac || b.count - a.count || a.idx - b.idx);

  for (let i = 0; i < remainder && i < order.length; i += 1) {
    floored[order[i].idx] += 1;
  }

  return floored;
}

const CHANNEL_CONFIG: Array<{ id: OrderChannel; label: string; color: string }> = [
  { id: "whatsapp", label: CHANNEL_LABELS.whatsapp, color: "#538690" },
  { id: "operator", label: CHANNEL_LABELS.operator, color: "#5120dc" },
];

export function computeChannelBreakdown(orders: Order[]): BreakdownItem[] {
  const counts = CHANNEL_CONFIG.map(
    (item) => orders.filter((order) => order.channel === item.id).length,
  );
  const percentages = largestRemainderPercentages(counts);

  return CHANNEL_CONFIG.map((item, idx) => ({
    id: item.id,
    label: item.label,
    count: counts[idx],
    percentage: percentages[idx],
    color: item.color,
  }));
}

const MODALITY_CONFIG: Array<{ id: OrderModality; label: string; color: string }> = [
  { id: "delivery", label: MODALITY_LABELS.delivery, color: "#fe674a" },
  { id: "pickup", label: MODALITY_LABELS.pickup, color: "#538690" },
  { id: "onsite", label: MODALITY_LABELS.onsite, color: "#5120dc" },
];

export function computeModalityBreakdown(orders: Order[]): BreakdownItem[] {
  const counts = MODALITY_CONFIG.map(
    (item) => orders.filter((order) => order.modality === item.id).length,
  );
  const percentages = largestRemainderPercentages(counts);

  return MODALITY_CONFIG.map((item, idx) => ({
    id: item.id,
    label: item.label,
    count: counts[idx],
    percentage: percentages[idx],
    color: item.color,
  }));
}

export interface PaymentStatusStats {
  paidCount: number;
  pendingCount: number;
  paidAmount: number;
  pendingAmount: number;
  paidPercent: number;
  pendingPercent: number;
}

export function computePaymentStatusStats(orders: Order[]): PaymentStatusStats {
  const billable = orders.filter((order) => order.stage !== "cancelled");

  let paidCount = 0;
  let pendingCount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;

  for (const order of billable) {
    if (order.paid) {
      paidCount += 1;
      paidAmount += order.total;
    } else {
      pendingCount += 1;
      pendingAmount += order.total;
    }
  }

  const [paidPercent, pendingPercent] = largestRemainderPercentages([
    paidCount,
    pendingCount,
  ]);

  return {
    paidCount,
    pendingCount,
    paidAmount,
    pendingAmount,
    paidPercent,
    pendingPercent,
  };
}

// ---------------------------------------------------------------------------
// History & Heatmap helpers
// ---------------------------------------------------------------------------

export interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  monthLabel: string;
  weekday: number; // 0 = Mon ... 6 = Sun
}

export interface HeatmapMonthBlock {
  key: string; // YYYY-MM
  label: string;
  weeks: Array<Array<HeatmapDay | null>>;
}

function computeHeatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function buildHeatmapFromDates(orders: Order[], dates: string[]): HeatmapDay[] {
  if (dates.length === 0) return [];

  const counts = new Map<string, number>();
  for (const order of orders) {
    const ymd = isoToLocalYmd(order.deliveredAt ?? order.createdAt);
    counts.set(ymd, (counts.get(ymd) ?? 0) + 1);
  }

  const years = new Set(dates.map((d) => d.slice(0, 4)));
  const multiYear = years.size > 1;

  return dates.map((date) => {
    const parsed = parseLocalYmd(date);
    const weekday = (parsed.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const monthName = CAPITALIZED_MONTHS_ES[parsed.getMonth()] ?? "";
    const monthLabel = multiYear
      ? `${monthName} ${String(parsed.getFullYear()).slice(2)}`
      : monthName;
    const count = counts.get(date) ?? 0;
    const level = computeHeatmapLevel(count);

    return {
      date,
      count,
      level,
      monthLabel,
      weekday,
    };
  });
}

export function buildActivityHeatmap(
  orders: Order[],
  spanDays: number,
  now: Date = new Date(),
): HeatmapDay[] {
  const safeSpan = Math.max(15, Math.min(360, Math.round(spanDays)));
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dates: string[] = [];

  for (let i = safeSpan - 1; i >= 0; i -= 1) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    dates.push(toLocalYmd(d));
  }

  return buildHeatmapFromDates(orders, dates);
}

export function buildActivityHeatmapForRange(
  orders: Order[],
  start: string,
  end: string,
): HeatmapDay[] {
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  const startDate = parseLocalYmd(lo);
  const endDate = parseLocalYmd(hi);
  const diffDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / 86_400_000,
  );
  const clampedStart = diffDays > 365 ? addDaysYmd(hi, -365) : lo;
  const dates = enumerateDays(clampedStart, hi);
  return buildHeatmapFromDates(orders, dates);
}

export function groupHeatmapByMonth(days: HeatmapDay[]): HeatmapMonthBlock[] {
  if (days.length === 0) return [];

  const monthOrder: string[] = [];
  const byMonth = new Map<string, HeatmapDay[]>();

  for (const day of days) {
    const key = day.date.slice(0, 7);
    let list = byMonth.get(key);
    if (!list) {
      list = [];
      byMonth.set(key, list);
      monthOrder.push(key);
    }
    list.push(day);
  }

  return monthOrder.map((key) => {
    const monthDays = byMonth.get(key)!;
    const label = monthDays[0]?.monthLabel ?? key;

    const weeks: Array<Array<HeatmapDay | null>> = [];
    let currentWeek: Array<HeatmapDay | null> = [];

    const firstWeekday = monthDays[0].weekday;
    for (let pad = 0; pad < firstWeekday; pad += 1) {
      currentWeek.push(null);
    }

    for (const day of monthDays) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return { key, label, weeks };
  });
}

// ---------------------------------------------------------------------------
// Sorting & Pagination
// ---------------------------------------------------------------------------

export type HistorySortKey =
  | "code"
  | "createdAt"
  | "customerName"
  | "modality"
  | "stage"
  | "paymentMethod"
  | "total";

export function sortOrders(
  orders: Order[],
  key: HistorySortKey,
  direction: "asc" | "desc",
): Order[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...orders].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "code":
        cmp = a.code.localeCompare(b.code, "es-CO", { numeric: true });
        break;
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "customerName":
        cmp = a.customerName.localeCompare(b.customerName, "es-CO");
        break;
      case "modality":
        cmp = (MODALITY_LABELS[a.modality] ?? a.modality).localeCompare(
          MODALITY_LABELS[b.modality] ?? b.modality,
          "es-CO",
        );
        break;
      case "stage":
        cmp = (STAGE_LABELS[a.stage] ?? a.stage).localeCompare(
          STAGE_LABELS[b.stage] ?? b.stage,
          "es-CO",
        );
        break;
      case "paymentMethod":
        cmp = (PAYMENT_METHOD_LABELS[a.paymentMethod] ?? a.paymentMethod).localeCompare(
          PAYMENT_METHOD_LABELS[b.paymentMethod] ?? b.paymentMethod,
          "es-CO",
        );
        break;
      case "total":
        cmp = a.total - b.total;
        break;
    }
    return cmp * factor;
  });
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; totalPages: number; safePage: number } {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const startIdx = (safePage - 1) * safeSize;
  return {
    items: items.slice(startIdx, startIdx + safeSize),
    totalPages,
    safePage,
  };
}

// ---------------------------------------------------------------------------
// CSV builders
// ---------------------------------------------------------------------------

const UTF8_BOM = "\uFEFF";

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? "");
  const safe =
    typeof value === "string" && /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  if (!/[",\r\n]/.test(safe)) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatCsvDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function buildAnalyticsCsv(orders: Order[]): string {
  const headers = [
    "ID Pedido",
    "Cliente",
    "Teléfono",
    "Canal",
    "Modalidad",
    "Monto Total",
    "Estado",
    "Fecha",
  ];

  const rows: Array<Array<string | number>> = orders.map((order) => [
    order.code,
    order.customerName,
    order.customerPhone,
    CHANNEL_LABELS[order.channel] ?? order.channel,
    MODALITY_LABELS[order.modality] ?? order.modality,
    order.total,
    STAGE_LABELS[order.stage] ?? order.stage,
    formatCsvDateTime(order.createdAt),
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(","),
  );

  return UTF8_BOM + lines.join("\r\n");
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof document === "undefined") return;
  const contentWithBom = csvContent.startsWith(UTF8_BOM)
    ? csvContent
    : UTF8_BOM + csvContent;
  const blob = new Blob([contentWithBom], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
