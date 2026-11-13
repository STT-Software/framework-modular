import { useEffect, useRef, useState } from "react";

export interface BrandMessage {
  title: string;
  subtitle: string;
}

const EXIT_DURATION_MS = 240;

export function useRotatingBrandMessages(count: number, intervalMs = 4800) {
  const [index, setIndex] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (count <= 1) return;

    const timer = window.setInterval(() => {
      setFadeState("out");
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % count);
        setFadeState("in");
      }, EXIT_DURATION_MS);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [count, intervalMs]);

  function selectIndex(nextIndex: number) {
    if (nextIndex === index) return;
    setFadeState("out");
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIndex(nextIndex);
      setFadeState("in");
    }, EXIT_DURATION_MS);
  }

  return { index, fadeState, selectIndex };
}

interface BrandMessageDisplayProps {
  message: BrandMessage;
  messageKey: number;
  fadeState: "in" | "out";
}

/** Renders the centered rotating brand headline and subtitle with staggered motion. */
export function BrandMessageDisplay({
  message,
  messageKey,
  fadeState,
}: BrandMessageDisplayProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        key={messageKey}
        className={fadeState === "out" ? "sa-msg-exit pointer-events-none" : undefined}
      >
        <h2
          className={`font-bold text-[36px] tracking-tight leading-[1.18] text-white drop-shadow-sm ${
            fadeState === "in" ? "sa-msg-enter-title" : ""
          }`}
        >
          {message.title}
        </h2>
        <p
          className={`font-normal text-[16px] leading-[1.7] text-white/90 mt-4 max-w-sm mx-auto ${
            fadeState === "in" ? "sa-msg-enter-subtitle" : ""
          }`}
        >
          {message.subtitle}
        </p>
      </div>
    </div>
  );
}

interface BrandMessageIndicatorsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}

/** Renders rotation dots; must be a direct child of the relative <aside> panel. */
export function BrandMessageIndicators({
  count,
  activeIndex,
  onSelect,
}: BrandMessageIndicatorsProps) {
  if (count <= 1) return null;

  return (
    <div className="absolute bottom-[38px] left-[48px] flex items-center gap-1.5 z-20 pointer-events-auto">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={`h-[5px] rounded-full transition-all duration-300 cursor-pointer ${
            i === activeIndex
              ? "w-[18px] bg-[#190088] dark:bg-[#FF3F1A]"
              : "w-[5px] bg-white/40 hover:opacity-80"
          }`}
          aria-label={`Mensaje ${i + 1}`}
        />
      ))}
    </div>
  );
}
