import { LOGO_PATHS, MARK_PATH_COUNT, TAGLINE_PATH_COUNT } from "@/brand/logoPaths";

/*
 * One-time code illustration shared by /business/access (slide "codigo") and the /super/register code step:
 * a code card rising out of an open envelope, stamped with a cyan "verified" seal, with a clock token (validity)
 * and a shield token (secure access). Draws in a 460×350 box. Colors come only from the `<prefix>-art-*` classes of
 * the module that renders it (`na-` in business-access.css, `sa-` in auth-layout.css), so each panel keeps its theme.
 */

export type ArtClassPrefix = "na" | "sa";

type P = { p: ArtClassPrefix };

const MARK_PATHS = LOGO_PATHS.slice(TAGLINE_PATH_COUNT, TAGLINE_PATH_COUNT + MARK_PATH_COUNT);

/** The Necto mark drawn inside an SVG, `size` units wide, top-left at (x, y). */
export function ArtMark({ p, x, y, size }: P & { x: number; y: number; size: number }) {
  return (
    <g className={`${p}-art-mark`} transform={`translate(${x} ${y}) scale(${size / 24})`}>
      {MARK_PATHS.map((path, i) => (
        <path key={i} d={path.d} fill={path.fill} />
      ))}
    </g>
  );
}

/** Cyan round badge with a check, centered at (cx, cy). */
export function ArtCheckBadge({ p, cx, cy, r = 10 }: P & { cx: number; cy: number; r?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${r / 10})`}>
      <circle className={`${p}-art-cyan`} r="10" />
      <path className={`${p}-art-check`} d="m-4.5 0 3 3 6-6.2" />
    </g>
  );
}

/** Four-pointed sparkle centered at (cx, cy). */
export function ArtSpark({ p, cx, cy, size = 14 }: P & { cx: number; cy: number; size?: number }) {
  const h = size / 2;
  const w = size / 7;
  return (
    <path
      className={`${p}-art-spark`}
      d={`M${cx} ${cy - h}l${w} ${h - w} ${h - w} ${w}-${h - w} ${w}-${w} ${h - w}-${w}-${h - w}-${h - w}-${w} ${h - w}-${w}Z`}
    />
  );
}

/** Background orbit pair (dotted circle + tilted ellipse); pass the center. */
export function ArtOrbits({ p, cx = 230, cy = 174 }: P & { cx?: number; cy?: number }) {
  return (
    <>
      <circle className={`${p}-art-orbit`} cx={cx} cy={cy} r="132" />
      <ellipse className={`${p}-art-orbit-solid`} cx={cx} cy={cy} rx="176" ry="92" transform={`rotate(-24 ${cx} ${cy})`} />
    </>
  );
}

// Six code cells split 3 + 3 around a center dot (card coordinates, card centered on x = 230).
const CODE_DIGITS = ["4", "8", "2", "1", "9", "5"];
const CELL_X = [172, 191, 210, 234, 253, 272];

interface CodeVerificationArtProps {
  classPrefix: ArtClassPrefix;
  /**
   * Optional motion hooks for the module that animates the art (today the /super/register code step): `"intro"` lets
   * its CSS play the entrance, `"sealed"` closes the envelope (card in, flap down, seal stamped). Without it the art is
   * static, as in business-access. Each piece is wrapped in a `<prefix>-cv-*` group so CSS can move it without
   * touching the drawing.
   */
  state?: "intro" | "sealed";
}

export function CodeVerificationArt({ classPrefix, state }: CodeVerificationArtProps) {
  const sealArcId = `${classPrefix}-code-seal-arc`;
  const cv = (name: string) => `${classPrefix}-cv-${name}`;
  const flap = "M150 166 230 120l80 46";
  return (
    <svg className={`${classPrefix}-slide-art`} viewBox="0 0 460 350" fill="none" data-state={state}>
      {/* Background: orbits, dotted links, sparks and base shadow */}
      <g className={cv("orbits")}>
        <ArtOrbits p={classPrefix} />
        <path className={`${classPrefix}-art-link`} strokeDasharray="1 4" d="M118 112Q140 150 132 186M354 126Q394 178 340 214" />
      </g>
      <g className={cv("spark")}>
        <ArtSpark p={classPrefix} cx={148} cy={46} size={14} />
      </g>
      <g className={cv("spark")}>
        <ArtSpark p={classPrefix} cx={386} cy={252} size={10} />
      </g>
      <ellipse className={`${classPrefix}-art-shadow ${cv("shadow")}`} cx="232" cy="300" rx="122" ry="10" />

      {/* Envelope back and open flap (behind the card) */}
      <g className={cv("envelope")}>
        <rect className={`${classPrefix}-art-card`} x="148" y="162" width="164" height="124" rx="10" />
        <path className={`${classPrefix}-art-card ${cv("flap-open")}`} strokeLinejoin="round" d={flap} />
      </g>

      {/* Code card rising out of the envelope */}
      <g className={cv("card")}>
      <g transform="rotate(-4 230 156)">
        <rect className={`${classPrefix}-art-card`} x="162" y="66" width="136" height="150" rx="14" />
        <rect className={`${classPrefix}-art-orange-tint`} x="174" y="78" width="26" height="26" rx="8" />
        <ArtMark p={classPrefix} x={178} y={82} size={18} />
        <text className={`${classPrefix}-art-label`} x="208" y="88" fontSize="6">
          CÓDIGO DE ACCESO
        </text>
        <text className={`${classPrefix}-art-text`} x="208" y="100" fontSize="8">
          Un solo uso
        </text>
        {CODE_DIGITS.map((digit, i) => (
          <g key={i}>
            <rect className={`${classPrefix}-art-soft`} x={CELL_X[i]} y="116" width="16" height="22" rx="5" />
            <text className={`${classPrefix}-art-text`} x={CELL_X[i] + 8} y="131" fontSize="11" textAnchor="middle">
              {digit}
            </text>
          </g>
        ))}
        <circle className={`${classPrefix}-art-ink`} cx="230" cy="127" r="1.4" />
        {/* Quiet expiry line: kept neutral so the orange mark and the clock carry the accent */}
        <rect className={`${classPrefix}-art-soft`} x="176" y="150" width="108" height="4" rx="2" />
      </g>
      </g>

      {/* Envelope front pocket with its folds */}
      <g className={cv("envelope")}>
        <path className={`${classPrefix}-art-card`} strokeLinejoin="round" d="M148 170 230 214l82-44v106a10 10 0 0 1-10 10H158a10 10 0 0 1-10-10Z" />
        <path className={`${classPrefix}-art-rule`} d="m154 281 58-40m94 40-58-40" />
        {/* The flap that folds down over the card when the envelope is sealed (hidden until then) */}
        {state ? <path className={`${classPrefix}-art-card ${cv("flap-close")}`} strokeLinejoin="round" d={flap} /> : null}
      </g>

      {/* Verification seal stamped on the envelope */}
      <g className={cv("seal")}>
      <g transform="translate(304 240) rotate(-6)">
        <circle className={`${classPrefix}-art-card`} r="30" />
        <path id={sealArcId} d="M-19.9 11.5a23 23 0 1 1 39.8 0" fill="none" />
        <text className={`${classPrefix}-art-label`} fontSize="6" textAnchor="middle">
          <textPath href={`#${sealArcId}`} startOffset="50%">
            CÓDIGO VERIFICADO
          </textPath>
        </text>
        <ArtCheckBadge p={classPrefix} cx={0} cy={4} r={11} />
      </g>
      </g>

      {/* Satellite: clock token (validity) */}
      <g className={cv("clock")}>
      <g transform="translate(96 222) rotate(-12)">
        <rect className={`${classPrefix}-art-card`} x="-29" y="-29" width="58" height="58" rx="18" />
        <circle className={`${classPrefix}-art-icon-accent`} cy="-6" r="10" />
        <path className={`${classPrefix}-art-icon-accent`} d="M0-12v6l4 3" />
        <text className={`${classPrefix}-art-text`} y="17" fontSize="7" textAnchor="middle">
          10 min
        </text>
      </g>
      </g>

      {/* Satellite: shield token (secure access) */}
      <g className={cv("shield")}>
      <g transform="translate(356 88) rotate(9)">
        <rect className={`${classPrefix}-art-card`} x="-27.5" y="-27.5" width="55" height="55" rx="18" />
        <path className={`${classPrefix}-art-icon`} d="M0-12 10-8v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13v-7Z" />
        <path className={`${classPrefix}-art-icon`} d="m-4 0 3 3 5.5-5.5" />
      </g>
      </g>

      {/* Cyan orb */}
      <g className={cv("orb")}>
        <circle className={`${classPrefix}-art-cyan-halo`} cx="112" cy="104" r="11.5" />
        <circle className={`${classPrefix}-art-cyan`} cx="112" cy="104" r="5.5" />
      </g>
    </svg>
  );
}
