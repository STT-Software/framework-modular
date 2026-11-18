import type { CSSProperties, ReactNode } from "react";
import "./skeleton.css";

type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  className?: string;
  style?: CSSProperties;
};

/** Decorative placeholder block. Hidden from assistive tech; wrap groups in SkeletonGroup. */
export function Skeleton({ width = "100%", height = 14, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `sk-block ${className}` : "sk-block"}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

type SkeletonGroupProps = {
  children: ReactNode;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

/** Busy region that announces loading to screen readers. */
export function SkeletonGroup({ children, label = "Cargando", className, style }: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className} style={style}>
      <span className="sk-sr-only">{label}</span>
      {children}
    </div>
  );
}
