import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "./logoPaths";
import "./scene-art.css";

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark (the N and its corner) drawn inside an SVG, `size` units wide, top-left at (x, y). */
export function ArtMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g className="sa-art-mark" transform={`translate(${x} ${y}) scale(${size / 24})`}>
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
      <circle className="sa-art-cyan" r="10" />
      <path className="sa-art-check" d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Four-pointed sparkle centered at (cx, cy). */
export function ArtSpark({ cx, cy, size = 14 }: { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className="sa-art-spark"
      d={`M${cx} ${cy - h}l${w} ${h - w} ${h - w} ${w}-${h - w} ${w}-${w} ${h - w}-${w}-${h - w}-${h - w}-${w} ${h - w}-${w}Z`}
    />
  );
}

/** Background orbit pair (dotted circle + tilted ellipse); pass the center. */
export function ArtOrbits({ cx = 230, cy = 174 }: { cx?: number; cy?: number }) {
  return (
    <>
      <circle className="sa-art-orbit" cx={cx} cy={cy} r="132" />
      <ellipse className="sa-art-orbit-solid" cx={cx} cy={cy} rx="176" ry="92" transform={`rotate(-24 ${cx} ${cy})`} />
    </>
  );
}
