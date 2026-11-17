import { useEffect, useRef } from "react";

/** Moves the focus to the screen's heading when it appears, so keyboard and screen reader users start there. */
export function useFocusHeading<T extends HTMLElement = HTMLHeadingElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
