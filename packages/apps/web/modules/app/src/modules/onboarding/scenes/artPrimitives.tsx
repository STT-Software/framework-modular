import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";

/*
 * Shared SVG primitives of the onboarding art (viewBox 0 0 460 350 unless a scene says otherwise), with the same
 * geometry as RegisterScenes (/super/register) and BrandScenes (/business/access): flat editorial geometry, rounded
 * cards (border 1.3), icon strokes 1.5 with round caps, the Necto mark where it adds meaning, no heavy gradients, no
 * people. Colors only through the `ob-art-*` classes in onboarding.css. Used by the intro (`LaunchSequence`), the
 * profile steps (`SetupArt`) and the closing screen (`ReadyScene`).
 */

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark (the N and its corner), `size` units wide, top-left at (x, y). */
export function ArtMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g className="ob-art-mark" transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {MARK_PATHS.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </g>
  );
}

/** Cyan round badge with a check, centered at (cx, cy). */
export function ArtCheckBadge({ cx, cy, r = 10 }: { cx: number; cy: number; r?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r / 10})`}>
      <circle className="ob-art-cyan" r="10" />
      <path className="ob-art-check" d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Four-pointed sparkle centered at (cx, cy). */
export function ArtSpark({ cx, cy, size = 14 }: { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className="ob-art-spark"
      d={`M${cx} ${cy - h}l${w} ${h - w} ${h - w} ${w}-${h - w} ${w}-${w} ${h - w}-${w}-${h - w}-${h - w}-${w} ${h - w}-${w}Z`}
    />
  );
}

/**
 * Background orbit pair: tilted ellipse, plus the dotted circle when `ring` is set. The intro draws that circle in a
 * separate GPU layer (`ArtOrbitRing` in LaunchSequence) so it can turn without repainting the scene.
 */
export function ArtOrbits({ cx = 230, cy = 174, ring = false }: { cx?: number; cy?: number; ring?: boolean }) {
  return (
    <>
      {ring ? <circle className="ob-art-orbit" cx={cx} cy={cy} r="132" /> : null}
      <ellipse className="ob-art-orbit-solid" cx={cx} cy={cy} rx="176" ry="92" transform={`rotate(-24 ${cx} ${cy})`} />
    </>
  );
}

/** One piece of a scene that enters on its own, in `order` (see `.ob-art-pop` in onboarding.css). */
export function Pop({ order, children }: { order: number; children: ReactNode }) {
  return (
    <g className="ob-art-pop" style={{ "--pop": order } as CSSProperties}>
      {children}
    </g>
  );
}

interface ArtStageProps {
  /** Seconds before the first piece enters (the screen's own entrance comes first). */
  start: number;
  className?: string;
  children: ReactNode;
}

/** How long the loops of a standalone illustration run before they rest (the person is filling a form). */
const SETTLE_MS = 14_000;

/**
 * A standalone illustration outside the intro (profile steps, closing screen). It plays like an active intro scene
 * (pieces enter, small loops run) and, after `SETTLE_MS`, pauses its loops so an idle form never keeps the main
 * thread busy repainting the SVG.
 */
export function ArtStage({ start, className, children }: ArtStageProps) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      className={`ob-art-scene is-active ob-art-stage${settled ? " is-settled" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--pop-start": `${start}s` } as CSSProperties}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
