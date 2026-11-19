import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";

/*
 * Small illustrations of the workspace popovers (notifications and help), in the same language as the welcome and
 * access scenes: white cards with a soft line, indigo ink, orange accent, cyan check badges, dotted orbits and
 * four-point sparks. Colors come only from the `ws-art-*` classes in workspace.css, so light and dark themes follow.
 */

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark, `size` units wide, top-left at (x, y). */
function Mark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g className="ws-art-mark" transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {MARK_PATHS.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </g>
  );
}

function Spark({ cx, cy, size = 10 }: { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className="ws-art-spark"
      d={`M${cx} ${cy - h}C${cx + w} ${cy - w} ${cx + w} ${cy - w} ${cx + h} ${cy}C${cx + w} ${cy + w} ${cx + w} ${cy + w} ${cx} ${cy + h}C${cx - w} ${cy + w} ${cx - w} ${cy + w} ${cx - h} ${cy}C${cx - w} ${cy - w} ${cx - w} ${cy - w} ${cx} ${cy - h}Z`}
    />
  );
}

function CheckBadge({ cx, cy, r = 8 }: { cx: number; cy: number; r?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r / 10})`}>
      <circle className="ws-art-cyan" r="10" />
      <path className="ws-art-check" d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Empty notifications: a bell card resting on its orbit, with the cyan "all clear" check. */
export function NotificationsEmptyArt() {
  return (
    <svg viewBox="0 0 160 110" fill="none" className="ws-art" aria-hidden="true">
      <ellipse className="ws-art-orbit" cx="80" cy="58" rx="66" ry="30" transform="rotate(-8 80 58)" />
      <rect className="ws-art-card" x="54" y="22" width="52" height="58" rx="16" />
      <path className="ws-art-icon" d="M70 58a10 10 0 0 1 20 0c0 9 4 11 4 11H66s4-2 4-11M76.5 74a4 4 0 0 0 7 0" transform="translate(0 -14)" />
      <CheckBadge cx={104} cy={26} r={9} />
      <Spark cx={34} cy={34} size={11} />
      <Spark cx={132} cy={78} size={8} />
      <circle className="ws-art-cyan" cx="28" cy="76" r="3.4" />
    </svg>
  );
}

/** Necto announcement: the N hub with three modules on its orbit, joined by dotted links. */
export function AnnouncementArt() {
  const tiles = [
    { x: 54, y: 48, glyph: "M-6 -1v7h12v-7M-8-6h16l1 4a2.6 2.6 0 0 1-4.5 1 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5-1Z" },
    { x: 246, y: 30, glyph: "M-8-6h16v10H-1l-5 4v-4h-2Z" },
    { x: 250, y: 74, glyph: "M-7-3 0-7l7 4-7 4ZM-7-3v7l7 4V1M7-3v7L0 8" },
  ];
  return (
    <svg viewBox="0 0 300 100" fill="none" className="ws-art" aria-hidden="true">
      <ellipse className="ws-art-orbit" cx="150" cy="52" rx="122" ry="34" />
      {tiles.map((t) => (
        <path key={t.x} className="ws-art-link" strokeDasharray="1 4" d={`M${t.x < 150 ? t.x + 18 : t.x - 18} ${t.y}L${t.x < 150 ? 128 : 172} 52`} />
      ))}
      <rect className="ws-art-card" x="126" y="28" width="48" height="48" rx="15" />
      <rect className="ws-art-orange-tint" x="134" y="36" width="32" height="32" rx="10" />
      <Mark x={139} y={41} size={22} />
      <CheckBadge cx={172} cy={30} r={7} />
      {tiles.map((t) => (
        <g key={t.y} transform={`translate(${t.x} ${t.y})`}>
          <rect className="ws-art-card" x="-17" y="-17" width="34" height="34" rx="11" />
          <path className="ws-art-icon" d={t.glyph} />
        </g>
      ))}
      <Spark cx={96} cy={18} size={10} />
      <Spark cx={206} cy={88} size={8} />
      <circle className="ws-art-cyan" cx="20" cy="62" r="3.2" />
    </svg>
  );
}

/** Tutorials: a video card with the orange play button and its progress bar. */
export function TutorialArt() {
  return (
    <svg viewBox="0 0 120 84" fill="none" className="ws-art" aria-hidden="true">
      <rect className="ws-art-card" x="14" y="10" width="92" height="62" rx="12" />
      <rect className="ws-art-soft" x="22" y="18" width="76" height="36" rx="7" />
      <circle className="ws-art-orange" cx="60" cy="36" r="10" />
      <path className="ws-art-on-accent" d="M57 31.5v9l7.5-4.5Z" />
      <rect className="ws-art-soft" x="22" y="61" width="76" height="4" rx="2" />
      <rect className="ws-art-orange" x="22" y="61" width="32" height="4" rx="2" />
      <Spark cx={108} cy={14} size={9} />
      <circle className="ws-art-cyan" cx="10" cy="62" r="3" />
    </svg>
  );
}

export type NoticeKind = "start" | "paused" | "necto";

/** Icon token of each notice kind: the same line glyphs, tinted per kind. */
export function NoticeToken({ kind }: { kind: NoticeKind }) {
  return (
    <span className={`ws-note-token is-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {kind === "start" && (
          <>
            <path d="M5 11v8h10M4 5h16l1 5a2.7 2.7 0 0 1-4.6 1 2.7 2.7 0 0 1-4.4 0 2.7 2.7 0 0 1-4.4 0A2.7 2.7 0 0 1 3 10Z" />
            <path d="M19 15v6M16 18h6" />
          </>
        )}
        {kind === "paused" && (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M10 9v6M14 9v6" />
          </>
        )}
        {kind === "necto" &&
          MARK_PATHS.map((path, i) => <path key={i} d={path.d} fill={path.fill} stroke="none" />)}
      </svg>
    </span>
  );
}
