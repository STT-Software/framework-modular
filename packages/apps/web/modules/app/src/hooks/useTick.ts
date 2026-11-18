import { useEffect, useState } from "react";

/**
 * The current time in milliseconds, refreshed every `everyMs` while `active` (to drive countdowns).
 * The timer pauses while the tab is hidden and catches up as soon as it is visible again.
 */
export function useTick(everyMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    const start = () => {
      setNow(Date.now());
      if (timer === undefined) timer = window.setInterval(() => setNow(Date.now()), everyMs);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [everyMs, active]);
  return now;
}

/** 90_000 -> "01:30". */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
