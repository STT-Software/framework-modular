import { useEffect, useState } from "react";

/**
 * The current time in milliseconds, refreshed every `everyMs` while `active` and the tab is visible
 * (to drive countdowns). Always derive remaining time from timestamps and this value, never from a
 * count of ticks: the interval pauses in hidden tabs and a fresh tick is forced when it becomes visible.
 */
export function useTick(everyMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      setNow(Date.now());
      timer = window.setInterval(() => setNow(Date.now()), everyMs);
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    if (document.hidden) setNow(Date.now());
    else start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [everyMs, active]);
  return now;
}

/** 90_000 -> "01:30". */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
