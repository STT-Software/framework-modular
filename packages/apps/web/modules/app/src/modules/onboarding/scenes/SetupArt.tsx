import type { CSSProperties } from "react";
import { SOURCE_GLYPHS, type SourceId } from "../sources";
import { ArtCheckBadge, ArtMark, ArtOrbits, ArtSpark, ArtStage, Pop } from "./artPrimitives";

/*
 * Illustrations of the profile steps and the closing screen, in the same language as the intro art (artPrimitives,
 * `ob-art-*` classes): the pieces enter one by one and a few small loops (floating tokens, typing dots, data flowing
 * along the dotted links) bring them to life, then rest after a while (`ArtStage`).
 */

/* ── Step 1 · phone: a contact number for the profile ──────────────────────────── */

/*
 * A slightly tilted phone holds the profile card: the Necto mark, the phone field with its dial code, a "Número
 * guardado" check and the orange "Continuar" button. Satellites: a message token (typing), a shield token (the number
 * stays private) and a call token, joined to the phone by dotted links that flow into it.
 */
export function PhoneArt() {
  return (
    <ArtStage start={0.3}>
      <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
        <ArtOrbits ring />
        <path
          className="ob-art-link ob-flow-dots"
          style={{ "--d": "0.9s" } as CSSProperties}
          strokeDasharray="1 4"
          d="M122 126Q146 140 168 144M346 128Q322 136 296 140M348 248Q322 240 294 232"
        />
        <ArtSpark cx={150} cy={40} size={13} />
        <ArtSpark cx={404} cy={186} size={10} />
        <ArtSpark cx={60} cy={236} size={11} />
        <ellipse className="ob-art-shadow" cx="230" cy="304" rx="104" ry="10" />

        <Pop order={0}>
          <g transform="rotate(-4 230 160)">
            <rect className="ob-art-card" x="168" y="40" width="124" height="240" rx="22" />
            <rect className="ob-art-soft" x="212" y="50" width="36" height="6" rx="3" />
            {/* Header: mark tile + title */}
            <rect className="ob-art-orange-tint" x="182" y="68" width="26" height="26" rx="8" />
            <ArtMark x={186} y={72} size={18} />
            <text className="ob-art-label" x="214" y="78" fontSize="6">
              TU PERFIL
            </text>
            <text className="ob-art-text" x="214" y="90" fontSize="9">
              Contacto
            </text>
            <path className="ob-art-rule" d="M182 104H278" />

            <Pop order={1}>
              {/* Phone field: dial code + number */}
              <text className="ob-art-label" x="182" y="120" fontSize="6">
                TELÉFONO
              </text>
              <rect className="ob-art-soft" x="182" y="126" width="96" height="24" rx="7" />
              <text className="ob-art-orange" x="189" y="141.5" fontSize="8" fontWeight="600">
                +57
              </text>
              <path className="ob-art-rule" d="M206 131v14" />
              <text className="ob-art-text" x="212" y="141.5" fontSize="8">
                300 123 4567
              </text>
            </Pop>

            <Pop order={2}>
              <rect className="ob-art-soft" x="182" y="162" width="96" height="22" rx="11" />
              <ArtCheckBadge cx={194} cy={173} r={6} />
              <text className="ob-art-text" x="205" y="175.5" fontSize="7">
                Número guardado
              </text>
            </Pop>

            <Pop order={3}>
              <rect className="ob-art-soft" x="182" y="196" width="72" height="5" rx="2.5" />
              <rect className="ob-art-soft" x="182" y="207" width="48" height="5" rx="2.5" />
              <rect className="ob-art-orange" x="182" y="226" width="96" height="24" rx="8" />
              <text className="ob-art-on-accent" x="230" y="241" fontSize="8" fontWeight="500" textAnchor="middle">
                Continuar
              </text>
            </Pop>
            <rect className="ob-art-soft" x="214" y="264" width="32" height="4" rx="2" />
          </g>
        </Pop>
        <Pop order={4}>
          <ArtCheckBadge cx={288} cy={44} r={9} />
        </Pop>

        {/* Satellite: message token, typing */}
        <Pop order={2}>
          <g className="ob-float" style={{ "--d": 0 } as CSSProperties}>
            <g transform="translate(94 112) rotate(-12)">
              <rect className="ob-art-card" x="-29" y="-29" width="58" height="58" rx="18" />
              <path className="ob-art-icon-accent" d="M-11-9h22v14h-12l-6 5v-5h-4Z" />
              {[-5, 0, 5].map((dx, i) => (
                <circle
                  key={dx}
                  className="ob-art-orange ob-typing-dot"
                  style={{ "--i": i } as CSSProperties}
                  cx={dx}
                  cy="-2"
                  r="1.4"
                />
              ))}
            </g>
          </g>
        </Pop>

        {/* Satellite: shield token, the number stays private */}
        <Pop order={3}>
          <g className="ob-float" style={{ "--d": 1 } as CSSProperties}>
            <g transform="translate(372 118) rotate(9)">
              <rect className="ob-art-card" x="-27.5" y="-27.5" width="55" height="55" rx="18" />
              <path className="ob-art-icon" d="M0-12 10-8v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13v-7Z" />
              <path className="ob-art-icon" d="m-4 0 3 3 5.5-5.5" />
            </g>
          </g>
        </Pop>

        {/* Satellite: call token */}
        <Pop order={4}>
          <g className="ob-float" style={{ "--d": 2 } as CSSProperties}>
            <g transform="translate(374 256) rotate(-8)">
              <rect className="ob-art-card" x="-28" y="-28" width="56" height="56" rx="18" />
              <path
                className="ob-art-icon"
                d="M-9-8.5c0 9.5 8 17.5 17.5 17.5l2.5-4.2-5-2.6-2.4 2.3c-3-1.4-5.2-3.6-6.6-6.6l2.3-2.4-2.6-5Z"
              />
              <path className="ob-art-icon-accent" d="M3-9a6 6 0 0 1 6 6M3-13a10 10 0 0 1 10 10" />
            </g>
          </g>
        </Pop>

        <circle className="ob-art-cyan-halo ob-halo-pulse" cx="100" cy="272" r="11.5" />
        <circle className="ob-art-cyan" cx="100" cy="272" r="5.5" />
      </svg>
    </ArtStage>
  );
}

/* ── Step 2 · source: where did you meet us ────────────────────────────────────── */

/*
 * The Necto hub in the center and the channels around it on the orbit (the same line glyphs as the choice cards),
 * each joined to the hub by a dotted link whose data flows into Necto. Instagram is the highlighted one (orange tile
 * and check), echoed by the "Llegaste por Instagram" pill under the hub.
 */
const SOURCE_HUB = { x: 230, y: 168 };
const SOURCE_TOKENS: { id: SourceId; x: number; y: number }[] = [
  { id: "instagram", x: 92, y: 112 },
  { id: "tiktok", x: 230, y: 54 },
  { id: "facebook", x: 368, y: 112 },
  { id: "youtube", x: 368, y: 228 },
  { id: "whatsapp", x: 230, y: 290 },
  { id: "linkedin", x: 92, y: 228 },
];
const SOURCE_HIGHLIGHT: SourceId = "instagram";
/** Token half size and hub half size: links run edge to edge. */
const TOKEN_R = 25;
const HUB_R = 42;

function sourceLink(x: number, y: number): string {
  const dx = SOURCE_HUB.x - x;
  const dy = SOURCE_HUB.y - y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const sx = x + ux * TOKEN_R;
  const sy = y + uy * TOKEN_R;
  const ex = SOURCE_HUB.x - ux * HUB_R;
  const ey = SOURCE_HUB.y - uy * HUB_R;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export function SourceArt() {
  return (
    <ArtStage start={0.3}>
      <svg className="ob-scene-art" viewBox="0 0 460 350" fill="none">
        <ArtOrbits ring cy={170} />
        <path
          className="ob-art-link ob-flow-dots"
          style={{ "--d": "1.4s" } as CSSProperties}
          strokeDasharray="1 4"
          d={SOURCE_TOKENS.map((t) => sourceLink(t.x, t.y)).join("")}
        />
        <ArtSpark cx={150} cy={40} size={12} />
        <ArtSpark cx={420} cy={170} size={10} />
        <ArtSpark cx={40} cy={170} size={11} />
        <ellipse className="ob-art-shadow" cx="230" cy="330" rx="120" ry="9" />

        {SOURCE_TOKENS.map((t, i) => {
          const on = t.id === SOURCE_HIGHLIGHT;
          return (
            <Pop key={t.id} order={1 + i}>
              <g className="ob-float" style={{ "--d": i % 3 } as CSSProperties}>
                <g transform={`translate(${t.x} ${t.y}) rotate(${i % 2 === 0 ? -8 : 7})`}>
                  <rect className="ob-art-card" x="-25" y="-25" width="50" height="50" rx="16" />
                  <rect
                    className={on ? "ob-art-orange-tint" : "ob-art-soft"}
                    x="-16"
                    y="-16"
                    width="32"
                    height="32"
                    rx="10"
                  />
                  <g className={on ? "ob-art-icon-accent" : "ob-art-icon"} transform="translate(-12 -12)">
                    {SOURCE_GLYPHS[t.id]}
                  </g>
                  {on ? <ArtCheckBadge cx={21} cy={-21} r={7} /> : null}
                </g>
              </g>
            </Pop>
          );
        })}

        <Pop order={0}>
          <rect className="ob-art-card" x="194" y="132" width="72" height="72" rx="20" />
          <ArtMark x={213} y={151} size={34} />
        </Pop>
        <Pop order={7}>
          <rect className="ob-art-card" x="166" y="214" width="128" height="26" rx="13" />
          <ArtCheckBadge cx={180} cy={227} r={6} />
          <text className="ob-art-text" x="191" y="230" fontSize="7.5">
            Llegaste por Instagram
          </text>
        </Pop>
      </svg>
    </ArtStage>
  );
}

/* ── Ready · the profile is complete (around the logo) ────────────────────────── */

/*
 * A wide strip drawn around the closing logo (viewBox 760 × 240, the logo sits in the middle): the two steps just
 * completed arrive as cards (the phone and where we met) and the workspace waits, ready, joined to the logo by dotted
 * links. The pieces enter once the logo has formed.
 */
export function ReadyArt() {
  return (
    <ArtStage start={2.5} className="ob-ready-art">
      <svg className="ob-scene-art" viewBox="0 0 760 240" fill="none">
        <path
          className="ob-art-link ob-flow-dots"
          style={{ "--d": "3.2s" } as CSSProperties}
          strokeDasharray="1 4"
          d="M206 98Q220 104 228 112M556 142Q544 134 534 128M168 178Q196 160 226 146"
        />
        <ArtSpark cx={250} cy={26} size={14} />
        <ArtSpark cx={514} cy={218} size={11} />
        <ArtSpark cx={60} cy={58} size={10} />
        <ArtSpark cx={714} cy={74} size={12} />

        {/* Step 1 · phone */}
        <Pop order={0}>
          <g className="ob-float" style={{ "--d": 0 } as CSSProperties}>
            <g transform="rotate(-6 122 82)">
              <rect className="ob-art-card" x="38" y="52" width="168" height="60" rx="16" />
              <rect className="ob-art-orange-tint" x="50" y="64" width="36" height="36" rx="11" />
              <rect className="ob-art-icon-accent" x="61" y="70" width="14" height="24" rx="3.5" />
              <path className="ob-art-icon-accent" d="M66 89h4" />
              <text className="ob-art-label" x="96" y="78" fontSize="7.5">
                TELÉFONO
              </text>
              <text className="ob-art-text" x="96" y="95" fontSize="12">
                Guardado
              </text>
              <ArtCheckBadge cx={204} cy={54} r={9} />
            </g>
          </g>
        </Pop>

        {/* Step 2 · source */}
        <Pop order={1}>
          <g className="ob-float" style={{ "--d": 1 } as CSSProperties}>
            <g transform="rotate(5 640 142)">
              <rect className="ob-art-card" x="556" y="112" width="168" height="60" rx="16" />
              <rect className="ob-art-soft" x="568" y="124" width="36" height="36" rx="11" />
              <g className="ob-art-icon" transform="translate(574 130)">
                {SOURCE_GLYPHS.instagram}
              </g>
              <text className="ob-art-label" x="614" y="138" fontSize="7.5">
                NOS CONOCISTE
              </text>
              <text className="ob-art-text" x="614" y="155" fontSize="12">
                Registrado
              </text>
              <ArtCheckBadge cx={722} cy={114} r={9} />
            </g>
          </g>
        </Pop>

        {/* The workspace, ready */}
        <Pop order={2}>
          <g className="ob-float" style={{ "--d": 2 } as CSSProperties}>
            <g transform="translate(140 192) rotate(-10)">
              <rect className="ob-art-card" x="-30" y="-30" width="60" height="60" rx="19" />
              <path className="ob-art-icon" d="M-12-1v12h24V-1M-14-1l3.2-9.5h21.6L14-1ZM-3.5 11V4.5h7V11" />
              <circle className="ob-art-cyan" cx="24" cy="-24" r="5" />
            </g>
          </g>
        </Pop>

        <Pop order={3}>
          <circle className="ob-art-cyan-halo ob-halo-pulse" cx="610" cy="58" r="11.5" />
          <circle className="ob-art-cyan" cx="610" cy="58" r="5.5" />
        </Pop>
      </svg>
    </ArtStage>
  );
}
