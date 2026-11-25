import type { ReactNode } from "react";
import { ICONS, QUEUE_HEX, type IconName } from "./icons";
/** Las piezas visuales de la aplicación del negocio (referencia `nd-`), compartidas con las pantallas de Turnos. */
export function Icon({ name, className, wrap }: { name: IconName | string; className?: string; wrap?: boolean }) {
  const paths = (ICONS as Record<string, string>)[name] ?? ICONS.grid;
  if (wrap) return <span data-nd-icon={name} dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>` }} />;
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths }} />;
}
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
export function Badge({ children, color = "" }: { children: ReactNode; color?: "" | "green" | "amber" | "purple" | "red" | "orange" | "blue" }) {
  return <span className={`nd-badge ${color}`}>{children}</span>;
}
/** El punto de color de una fila. */
export function QueueDot({ color }: { color: string }) {
  return <span className="nd-queue-dot" style={{ ["--queue-color" as string]: QUEUE_HEX[color] ?? QUEUE_HEX.orange }} aria-hidden="true" />;
}
export function CardHeading({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="nd-card-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {right}
    </div>
  );
}
export function Stat({ label, value, unit, icon, foot = "Durante esta jornada" }: { label: string; value: ReactNode; unit?: string; icon: IconName; foot?: string }) {
  return (
    <article className="nd-card nd-stat">
      <div className="nd-stat-top">
        <span className="nd-stat-symbol">
          <Icon name={icon} />
        </span>
        <span className="nd-stat-label">{label}</span>
      </div>
      <div className="nd-stat-value">
        <strong>{value}</strong>
        {unit ? <small>{unit}</small> : null}
      </div>
      <div className="nd-stat-bottom">{foot}</div>
    </article>
  );
}
export function Empty({ title, text, action, inline }: { title: string; text: string; action?: ReactNode; inline?: boolean }) {
  const body = (
    <>
      <span className="nd-module-symbol">
        <Icon name="queue" />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </>
  );
  return inline ? <div className="nd-empty inline">{body}</div> : <div className="nd-card nd-empty">{body}</div>;
}
export function InfoBox({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="nd-info-box">
      <Icon name="info" />
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}
export function SectionHeading({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="nd-section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {right}
    </div>
  );
}
/** El interruptor de la referencia: una casilla con aspecto de interruptor. */
export function Toggle({ checked, onChange, label, disabled, text }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean; text?: string }) {
  return (
    <label className="nd-toggle-label">
      {text ? <span>{text}</span> : null}
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="nd-toggle" aria-hidden="true" />
    </label>
  );
}
/** Un campo con su etiqueta, como los formularios de la referencia. */
export function Field({ id, label, required, hint, children }: { id: string; label: ReactNode; required?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="nd-field">
      <label htmlFor={id}>
        {label}
        {required ? (
          <>
            {" "}
            <b>*</b>
          </>
        ) : null}
      </label>
      {children}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
/** Una gráfica de línea sencilla (SVG), con etiquetas bajo cada punto. */
export function LineChart({ values, labels, title }: { values: number[]; labels: string[]; title: string }) {
  const width = 600;
  const height = 190;
  const pad = 24;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => [pad + (index * (width - 2 * pad)) / (values.length - 1 || 1), height - pad - (value / max) * (height - 2 * pad)]);
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.join(" ")}`).join(" ");
  const first = points[0] ?? [pad, height - pad];
  const last = points[points.length - 1] ?? first;
  return (
    <svg className="nd-chart" viewBox={`0 0 ${width} ${height + 20}`} role="img" aria-label={title}>
      <title>{title}</title>
      {[0, 1, 2, 3].map((index) => (
        <line key={index} className="nd-grid-line" x1="24" y1={24 + index * 47} x2="576" y2={24 + index * 47} />
      ))}
      <path className="nd-area" d={`${path} L${last[0]} 166 L${first[0]} 166Z`} />
      <path className="nd-line" d={path} />
      {points.map((point, index) => (
        <g key={index}>
          <circle cx={point[0]} cy={point[1]} r="3" style={{ fill: "var(--nd-purple)", stroke: "var(--nd-surface)", strokeWidth: 2 }} />
          <text x={point[0]} y="195" textAnchor="middle">
            {labels[index] ?? ""}
          </text>
        </g>
      ))}
    </svg>
  );
}
/** "Hace n min" a partir de un instante. */
export function elapsed(at: string | number | Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60000));
  if (minutes < 1) return "Hace un momento";
  if (minutes === 1) return "Hace 1 min";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "Hace 1 h" : hours < 24 ? `Hace ${hours} h` : `Hace ${Math.floor(hours / 24)} d`;
}
