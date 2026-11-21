import type { ReactNode } from "react";
import { ArtCheckBadge, ArtMark, ArtOrbits, ArtSpark } from "@/brand/SceneArt";
import "./guide-figure.css";

export function ArtStage({ label, children }: { label: string; children: ReactNode }) {
  return <div className="config-art-stage">
    <svg viewBox="20 20 430 295" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <ArtOrbits cx={232} cy={160} />
      <ellipse className="sa-art-shadow" cx="232" cy="286" rx="145" ry="9" />
      <g transform="translate(232 160) scale(1.08) translate(-232 -160)">
        {children}
      </g>
    </svg>
  </div>;
}

export function GuideFigure({ title, description, alternative, children }: {
  title: string; description: string; alternative: string; children: ReactNode;
}) {
  return <figure className="config-guide">
    <ArtStage label={alternative}>{children}</ArtStage>
    <figcaption><h2>{title}</h2><p>{description}</p></figcaption>
  </figure>;
}

const paths = {
  store: "M-11-1v11h22V-1M-13-1l3-9h20l3 9ZM-3 10V4h6v6",
  box: "m0-12 12 6v13l-12 6-12-6V-6Zm-12 6L0 0l12-6M0 0v13m-7-22 12 6",
  time: "M0-11a11 11 0 1 1 0 22 11 11 0 0 1 0-22ZM0-7v8l5 3",
  ticket: "M-12-8h24v5a3 3 0 0 0 0 6v5h-24V3a3 3 0 0 0 0-6Zm7 4v2m0 3v2",
  mail: "M-12-8h24V8h-24ZM-11-6 0 2l11-8",
  list: "M-5-7H11M-5 0H8M-5 7H5m-16-14h1m-1 7h1m-1 7h1",
  file: "M-9-12H3l7 7v17H-9Zm12 0v7h7M-4 1h9M-4 6h7",
  key: "M-5-7a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM1 0l12 3-1 5m-4-6-1 4",
  route: "M-12 8h6V-7H9m-4-4 5 4-5 4M-6 2H9m-4-4 5 4-5 4",
  check: "m-9 0 6 6L10-8",
} as const;
type Glyph = keyof typeof paths;

export function GlyphTile({ x,y,icon, angle = 0 }: { x:number; y:number; icon:Glyph; angle?:number }) {
  return <g className="art-glyph-tile" transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect className="sa-art-card" x="-28" y="-28" width="56" height="56" rx="17" />
    <path className="sa-art-icon" d={paths[icon]} />
  </g>;
}

function MarkTile({ x, y }: {x:number; y:number}) {
  return <g transform={`translate(${x} ${y})`}><rect className="sa-art-orange-tint" width="30" height="30" rx="9" /><ArtMark x={4} y={4} size={22} /></g>;
}

function short(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

interface Item { label: string; value: string; icon: Glyph; active?: boolean; }

// Orbiting cards follow the three business chips in the access panel.
export function HubArt({ items, icon }: { items: Item[]; icon: Glyph }) {
  const slots = [[66,66,-7],[266,121,6],[152,232,-3]];
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M195 188l-73 31" />
    {items.slice(0, 3).map((item, i) => (
      <path key={item.label} className="art-route" data-active={item.active !== false}
        d={["M202 153 154 111", "M264 173l30-19", "M230 210v31"][i]} />
    ))}
    {items.slice(0,3).map((item,i)=>{
      const [x,y,angle]=slots[i];
      return <g key={item.label} transform={`translate(${x} ${y}) rotate(${angle} 72 28)`}>
        <g key={item.value} className="art-card-arrive" data-inactive={item.active === false}>
        <rect className="sa-art-card" width="151" height="55" rx="14"/>
        <rect className="sa-art-soft" x="10" y="12" width="32" height="32" rx="9"/>
        <path className="sa-art-icon" d={paths[item.icon]} transform="translate(26 28) scale(.74)" />
        <text className="sa-art-text" x="51" y="26" fontSize="12">{short(item.label,15)}</text>
        <text className="sa-art-label" x="51" y="40" fontSize="8.5">{short(item.value,20)}</text>
        {item.active && <g className="art-stamp"><ArtCheckBadge cx={145} cy={4} r={8}/></g>}
        </g>
      </g>;
    })}
    <rect className="sa-art-card" x="191" y="138" width="72" height="72" rx="20"/>
    <ArtMark x={210} y={157} size={35}/>
    <GlyphTile x={94} y={220} icon={icon} angle={-12}/>
  </>;
}

// An identity pass with a detachable lower stub, as in the registration identity scene.
export function PassArt({ label, value, detail, chip, icon }: {
  label:string; value:string; detail:string; chip:string; icon:Glyph;
}) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M101 220q32 4 60-18m145-46 39-25" />
    <g className="art-floating-card" transform="rotate(-6 228 166)"><g key={value} className="art-ticket-feed">
      <rect className="sa-art-card" x="147" y="59" width="164" height="209" rx="18"/>
      <MarkTile x={214} y={75}/>
      <text className="sa-art-label" x="229" y="130" textAnchor="middle" fontSize="9">{label}</text>
      <text className="sa-art-text" x="229" y="163" textAnchor="middle" fontSize={value.length>10 ? 16 : 26}>{short(value,17)}</text>
      <text className="sa-art-text" x="229" y="184" textAnchor="middle" fontSize="11">{short(detail,24)}</text>
      <path className="sa-art-wire" strokeDasharray="3 4" d="M148 207h162"/>
      {[0,4,9,15,19,25,29,34,41,47,52,58,62,68,74].map((x,i)=><rect key={x} className="sa-art-ink" x={191+x} y="224" width={i%3===0?3:1.5} height="17" rx=".5"/>)}
    </g>
    </g>
    <GlyphTile icon={icon} x={91} y={214} angle={-12}/>
    <g transform="translate(274 91) rotate(6)">
      <rect className="sa-art-card" width="119" height="40" rx="12"/>
      <ArtCheckBadge cx={18} cy={20} r={9}/><text key={chip} className="sa-art-text art-value-change" x="34" y="24" fontSize="11">{short(chip,16)}</text>
    </g>
  </>;
}

export function BoardArt({ label, title, items, icon, metric }: {
  label:string; title:string; items:Item[]; icon:Glyph; metric?:string;
}) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M97 141q20 8 42 0m182 70 37 15"/>
    <g className="art-floating-card" transform="rotate(-3 230 170)">
      <rect className="sa-art-card" x="122" y="64" width="220" height="213" rx="18"/>
      <MarkTile x={136} y={77}/>
      <text className="sa-art-label" x="176" y="87" fontSize="8.5">{label}</text>
      <text key={title} className="sa-art-text art-value-change" x="176" y="104" fontSize="13">{short(title,22)}</text>
      <path className="sa-art-rule" d="M136 118h192"/>
      {items.map((item,i)=>{
        const y=127+i*46;
        return <g key={i}>
          <rect className={i===0?"sa-art-orange-tint":"sa-art-soft"} x="136" y={y} width="36" height="36" rx="10"/>
          <path className="sa-art-icon" transform={`translate(154 ${y+18}) scale(.78)`} d={paths[item.icon]}/>
          <text className="sa-art-label" x="182" y={y+11} fontSize="8.5">{item.label.toUpperCase()}</text>
          <text key={item.value} className="sa-art-text art-value-change" x="182" y={y+29} fontSize="13">{short(item.value,19)}</text>
          {item.active && <ArtCheckBadge cx={320} cy={y+20} r={6}/>}
        </g>;
      })}
    </g>
    <GlyphTile icon={icon} x={85} y={131} angle={-12}/>
    {metric ? <g transform="translate(277 242) rotate(5)">
      <rect className="sa-art-card" width="125" height="40" rx="12"/><ArtCheckBadge cx={17} cy={20} r={8}/>
      <text className="sa-art-text" x="31" y="24" fontSize="11">{short(metric,16)}</text>
    </g> : <GlyphTile icon="file" x={374} y={225} angle={9}/>}
  </>;
}
export function DirectoryArt({ title, entries, icon }: { title:string; entries:string[]; icon:Glyph }) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M102 116l40 28m188 66 40 23"/>
    <g className="art-floating-card" transform="rotate(-3 233 168)">
      <rect className="sa-art-card" x="128" y="70" width="210" height="196" rx="18"/>
      <MarkTile x={140} y={81}/>
      <text className="sa-art-label" x="180" y="92" fontSize="8.5">PERFIL DE ATENCIÓN</text>
      <text className="sa-art-text" x="180" y="107" fontSize="12">{short(title,21)}</text>
      <path className="sa-art-rule" d="M140 118h186"/>
      {entries.slice(0,4).map((entry,i)=>{
        const x=140+(i%2)*98, y=126+Math.floor(i/2)*67;
        return <g key={title + entry} className="art-card-arrive" style={{ animationDelay: `${i * 45}ms` }}>
          <rect className="sa-art-card" x={x} y={y} width="88" height="57" rx="12"/>
          <rect className="sa-art-soft" x={x+8} y={y+7} width="25" height="24" rx="8"/>
          <path className="sa-art-icon" d={paths.ticket} transform={`translate(${x+20} ${y+19}) scale(.64)`}/>
          <circle className="sa-art-cyan" cx={x+75} cy={y+15} r="3"/>
          <text className="sa-art-text" x={x+8} y={y+45} fontSize="11">{short(entry,13)}</text>
        </g>;
      })}
      {entries.length===0 && <text className="sa-art-text" x="232" y="182" textAnchor="middle" fontSize="13">Sin filas sugeridas</text>}
    </g>
    <ArtCheckBadge cx={336} cy={70} r={9}/>
    <GlyphTile x={82} y={111} angle={-12} icon={icon}/><GlyphTile x={380} y={236} angle={9} icon="list"/>
  </>;
}

export function TimelineArt({ times, urgency }: { times: [number, number, number]; urgency:number }) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M96 124q18 16 46 18m177 69 48 17"/>
    <g className="art-floating-card" transform="rotate(-4 228 172)">
      <rect className="sa-art-card" x="103" y="99" width="257" height="146" rx="17"/>
      <MarkTile x={116} y={110}/>
      <text className="sa-art-label" x="158" y="120" fontSize="8.5">PEDIDOS</text>
      <text className="sa-art-text" x="158" y="136" fontSize="13">Tiempos en minutos</text>
      <path className="sa-art-rule" d="M116 149h230"/>
      <path className="sa-art-wire" d="M143 185h171" strokeDasharray="2 4"/>
      {["Confirmar","Preparar","Despachar"].map((stage,i)=>{
        const x=149+i*81;
        return <g key={stage}>
          <circle className="sa-art-soft" cx={x} cy="184" r="24"/>
          <circle className="art-dial-track" cx={x} cy="184" r="21" />
          <g transform={`translate(${x} 184)`}>
            <path className="art-dial-hand" d="M-2-18 0-24l2 6Z" style={{ transform: `rotate(${times[i] * 6}deg)` }}/>
          </g>
          <text key={times[i]} className="sa-art-text art-value-change" x={x} y="190" textAnchor="middle" fontSize="15">{times[i]}</text>
          <text className="sa-art-text" x={x} y="226" textAnchor="middle" fontSize="11">{stage}</text>
        </g>;
      })}
    </g>
    <GlyphTile x={96} y={93} angle={-12} icon="time"/>
    <g transform="translate(262 236) rotate(5)"><rect className="sa-art-card" width="136" height="32" rx="11"/>
      <circle className="sa-art-cyan" cx="16" cy="16" r="4"/><text key={urgency} className="sa-art-text art-value-change" x="27" y="20" fontSize="11">Urgente · {urgency} min</text>
    </g>
  </>;
}
export function DispatchArt({ mode, freight, carrier }: { mode:string; freight:string; carrier?:string }) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M98 191q30 0 50-29m134 8q30 4 57 21"/>
    <g className="art-floating-card" transform="rotate(-5 210 164)">
      <rect className="sa-art-card" x="129" y="62" width="169" height="194" rx="16"/>
      <MarkTile x={143} y={77}/>
      <text className="sa-art-label" x="181" y="87" fontSize="8.5">PEDIDOS</text>
      <text className="sa-art-text" x="181" y="103" fontSize="12">Confirmación</text>
      <path className="sa-art-rule" d="M142 119h141"/>
      <text className="sa-art-label" x="144" y="142" fontSize="8">MÉTODO</text>
      <text key={mode} className="sa-art-text art-value-change" x="144" y="166" fontSize="19">{mode}</text>
      {carrier && <text key={carrier} className="sa-art-text art-value-change" x="144" y="194" fontSize="10">{short(carrier,26)}</text>}
      <rect className="sa-art-orange-tint" x="143" y="215" width="132" height="24" rx="8"/>
      <text key={freight} className="sa-art-text art-value-change" x="209" y="231" textAnchor="middle" fontSize="11">{freight}</text>
    </g>
    <GlyphTile x={89} y={182} icon="file" angle={-12}/>
    <g className="art-prep-box" transform="translate(266 183) rotate(7 49 41)">
      <rect className="sa-art-card" width="111" height="80" rx="14"/>
      <path className="sa-art-icon-accent" transform="translate(55 30) scale(1.2)" d={paths.box}/>
      <text className="sa-art-text" x="55" y="62" textAnchor="middle" fontSize="11">Preparación</text>
      <g key={mode} className="art-stamp"><ArtCheckBadge cx={108} cy={3} r={9}/></g>
    </g>
  </>;
}

export function QueueArt({ code, name, minutes }: {code:string; name:string; minutes?:number}) {
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M103 141q23 0 45 21m153 40 45 12"/>
    <g transform="rotate(5 242 154)">
      <rect className="sa-art-card" x="158" y="73" width="160" height="152" rx="16"/>
      <rect className="sa-art-soft" x="173" y="87" width="81" height="6" rx="3"/>
    </g>
    <g className="art-floating-card" transform="rotate(-5 221 169)"><g key={name + code} className="art-ticket-feed">
      <rect className="sa-art-card" x="129" y="97" width="180" height="151" rx="16"/>
      <MarkTile x={142} y={110}/>
      <text className="sa-art-label" x="182" y="128" fontSize="8">FILA DE ATENCIÓN</text>
      <text className="sa-art-text" x="219" y="176" fontSize="27" textAnchor="middle">{code}</text>
      <path className="sa-art-wire" strokeDasharray="3 4" d="M130 193h178"/>
      <text className="sa-art-text" x="219" y="222" fontSize="12" textAnchor="middle">{short(name,24)}</text>
    </g>
    </g>
    <GlyphTile x={86} y={146} icon="list" angle={-12}/>
    <g transform="translate(264 216) rotate(5)">
      <rect className="sa-art-card" width="127" height="44" rx="12"/>
      <path className="sa-art-icon" transform="translate(20 22) scale(.7)" d={paths.time}/>
      <text key={minutes} className="sa-art-text art-value-change" x="37" y="26" fontSize="11">{minutes === undefined ? "Sin configurar" : `${minutes} min / turno`}</text>
    </g>
  </>;
}
export function TeamArt({ names, total }: { names:string[]; total:number }) {
  const chips = names.length ? names.slice(0, 2) : ["Administrador"];
  return <>
    <path className="sa-art-link" strokeDasharray="1 4" d="M194 142q36-30 67-34m-66 91q27 9 58 14"/>
    <g className="art-floating-card" transform="rotate(-3 152 174)">
      <rect className="sa-art-card" x="89" y="94" width="120" height="167" rx="18"/>
      <MarkTile x={103} y={109}/>
      <text className="sa-art-label" x="103" y="159" fontSize="8.5">PEDIDOS</text>
      <text className="sa-art-text" x="103" y="179" fontSize="15">Tu equipo</text>
      <path className="sa-art-rule" d="M103 191h91"/>
      <circle className="sa-art-cyan" cx="111" cy="213" r="4"/>
      <text key={total} className="sa-art-text art-value-change" x="123" y="217" fontSize="11">{total} {total === 1 ? "operador" : "operadores"}</text>
      <rect className="sa-art-soft" x="103" y="231" width="78" height="6" rx="3"/>
    </g>
    {chips.map((name,i)=>{
      const x=239+i*10, y=85+i*73;
      const initials=name.trim().split(/\s+/).slice(0,2).map((word)=>word[0]).join("").toUpperCase();
      return <g key={i} transform={`translate(${x} ${y}) rotate(${i ? -4 : 4} 70 25)`}>
        <g key={name} className="art-card-arrive">
        <rect className="sa-art-card" width="150" height="55" rx="14"/>
        <circle className="sa-art-orange-tint" cx="24" cy="27" r="14"/>
        <text className="sa-art-text" x="24" y="31" fontSize="11" textAnchor="middle">{initials}</text>
        <text className="sa-art-text" x="46" y="25" fontSize="11">{short(name,16)}</text>
        <text className="sa-art-label" x="46" y="39" fontSize="8.5">{total ? "OPERADOR" : "ADMINISTRADOR"}</text>
        </g>
      </g>;
    })}
    <GlyphTile x={293} y={252} angle={9} icon="mail"/>
  </>;
}
