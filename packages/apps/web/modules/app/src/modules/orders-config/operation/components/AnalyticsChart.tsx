import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import ReactApexChart from "react-apexcharts";
import { cn } from "@/utils";

export type AnalyticsChartType =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "radialBar"
  | "scatter"
  | "heatmap";

export interface AnalyticsChartProps {
  type: AnalyticsChartType;
  series: ApexOptions["series"];
  options?: ApexOptions;
  height?: number | string;
  width?: number | string;
  className?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function readIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasChartData(series: ApexOptions["series"]): boolean {
  if (!Array.isArray(series) || series.length === 0) return false;
  if (typeof series[0] === "number") {
    return (series as number[]).some((value) => value > 0);
  }
  return (series as Array<{ data?: unknown[] }>).some(
    (entry) => Array.isArray(entry.data) && entry.data.length > 0,
  );
}

export function AnalyticsChart({
  type,
  series,
  options = {},
  height = 280,
  width = "100%",
  className,
  empty,
  emptyTitle = "Sin datos en este periodo",
  emptyDescription = "Ajusta el rango de fechas o espera nuevos pedidos para ver la gráfica.",
}: AnalyticsChartProps) {
  const [isDark, setIsDark] = useState<boolean>(readIsDark);
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState<boolean>(readReducedMotion);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  const mergedOptions = useMemo<ApexOptions>(() => {
    const themeDefaults: ApexOptions = isDark
      ? {
          chart: {
            background: "transparent",
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            toolbar: { show: false },
          },
          grid: { borderColor: "#1f2937" },
          xaxis: {
            labels: { style: { colors: "#9CA3AF", fontSize: "11px" } },
            axisBorder: { color: "#374151" },
            axisTicks: { color: "#374151" },
          },
          yaxis: {
            labels: { style: { colors: ["#9CA3AF"], fontSize: "11px" } },
          },
          legend: { labels: { colors: "#D1D5DB" } },
          tooltip: { theme: "dark" },
        }
      : {
          chart: {
            background: "transparent",
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            toolbar: { show: false },
          },
          grid: { borderColor: "#F2F4F7" },
          xaxis: {
            labels: { style: { colors: "#667085", fontSize: "11px" } },
            axisBorder: { color: "#E4E7EC" },
            axisTicks: { color: "#E4E7EC" },
          },
          yaxis: {
            labels: { style: { colors: ["#667085"], fontSize: "11px" } },
          },
          legend: { labels: { colors: "#344054" } },
          tooltip: { theme: "light" },
        };

    const mergedYaxis = (() => {
      const consumerY = options.yaxis;
      const defaultY = themeDefaults.yaxis;
      if (!consumerY) return defaultY;
      if (!defaultY) return consumerY;
      if (Array.isArray(consumerY) || Array.isArray(defaultY)) return consumerY;
      return {
        ...defaultY,
        ...consumerY,
        labels: {
          ...defaultY.labels,
          ...consumerY.labels,
          style: {
            ...defaultY.labels?.style,
            ...consumerY.labels?.style,
          },
        },
      };
    })();

    return {
      ...themeDefaults,
      ...options,
      chart: {
        ...themeDefaults.chart,
        ...options.chart,
        animations: {
          ...options.chart?.animations,
          ...(prefersReducedMotion ? { enabled: false } : {}),
        },
        toolbar: {
          ...themeDefaults.chart?.toolbar,
          ...options.chart?.toolbar,
        },
      },
      grid: {
        ...themeDefaults.grid,
        ...options.grid,
      },
      xaxis: {
        ...themeDefaults.xaxis,
        ...options.xaxis,
        labels: {
          ...themeDefaults.xaxis?.labels,
          ...options.xaxis?.labels,
          style: {
            ...themeDefaults.xaxis?.labels?.style,
            ...options.xaxis?.labels?.style,
          },
        },
        axisBorder: {
          ...themeDefaults.xaxis?.axisBorder,
          ...options.xaxis?.axisBorder,
        },
        axisTicks: {
          ...themeDefaults.xaxis?.axisTicks,
          ...options.xaxis?.axisTicks,
        },
      },
      yaxis: mergedYaxis,
      legend: {
        ...themeDefaults.legend,
        ...options.legend,
        labels: {
          ...themeDefaults.legend?.labels,
          ...options.legend?.labels,
        },
      },
      tooltip: {
        ...themeDefaults.tooltip,
        ...options.tooltip,
      },
    };
  }, [options, isDark, prefersReducedMotion]);

  const isEmpty = empty ?? !hasChartData(series);

  if (isEmpty) {
    const minHeight = typeof height === "number" ? `${height}px` : height;
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-10 text-center dark:border-gray-800 dark:bg-white/[0.02]",
          className,
        )}
        style={{ minHeight }}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {emptyTitle}
        </p>
        <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <ReactApexChart
        key={`${isDark ? "dark" : "light"}-${prefersReducedMotion ? "reduced" : "motion"}`}
        type={type}
        series={series}
        options={mergedOptions}
        height={height}
        width={width}
      />
    </div>
  );
}
