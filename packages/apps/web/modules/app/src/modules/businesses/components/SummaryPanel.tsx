import { NectoLogo } from "@/brand/NectoLogo";
import { MODULES } from "../catalog";
import type { ModuleId } from "../types";

interface SummaryPanelProps {
  name: string;
  categoryText: string;
  modules: ModuleId[];
  identityReady: boolean;
  modulesReviewed: boolean;
  bossName: string | null;
  completed: number;
}

/** Side panel of the setup: a live picture of the business being built (decorative) and its progress. */
export function SummaryPanel({ name, categoryText, modules, identityReady, modulesReviewed, bossName, completed }: SummaryPanelProps) {
  return (
    <aside className="bs-summary" aria-label="Resumen de configuración">
      <div className="bs-network" aria-hidden="true">
        <svg viewBox="0 0 280 180" fill="none">
          <ellipse cx="140" cy="92" rx="104" ry="63" className="bs-network-ring" />
          <path d="m140 92-90-37m90 37-61 55m61-55 78 48m-78-48 91-43m-91 43-4-67m4 67 1 67" className="bs-network-lines" />
          <g className={`bs-network-node${modules.includes("reservas") ? " is-on" : ""}`} transform="translate(35 40)">
            <rect width="30" height="30" rx="10" />
            <path d="M8 9h14v14H8V9Zm3-3v6m8-6v6M8 14h14" />
          </g>
          <g className={`bs-network-node${modules.includes("turnos") ? " is-on" : ""}`} transform="translate(63 131)">
            <rect width="30" height="30" rx="10" />
            <path d="M9 10h13M9 15h13M9 20h13" />
          </g>
          <g className={`bs-network-node${modules.includes("agendamiento") ? " is-on" : ""}`} transform="translate(120 9)">
            <rect width="30" height="30" rx="10" />
            <circle cx="15" cy="15" r="8" />
            <path d="M15 10v6h4" />
          </g>
          <g className={`bs-network-node${modules.includes("referidos") ? " is-on" : ""}`} transform="translate(216 33)">
            <rect width="30" height="30" rx="10" />
            <circle cx="15" cy="11" r="4" />
            <path d="M7 24v-2a8 8 0 0 1 16 0v2" />
          </g>
          <g className={`bs-network-node${modules.includes("inventario") ? " is-on" : ""}`} transform="translate(205 126)">
            <rect width="30" height="30" rx="10" />
            <path d="m15 7 8 4v10l-8 4-8-4V11l8-4Zm0 8v10m-8-14 8 4 8-4" />
          </g>
          <g className={`bs-network-node${modules.includes("pedidos") ? " is-on" : ""}`} transform="translate(127 149)">
            <rect width="28" height="28" rx="10" />
            <path d="M7 10h14v13H7V10Zm4 0V8a3 3 0 0 1 6 0v2" />
          </g>
        </svg>
        <span className="bs-network-logo">
          <NectoLogo variant="mark" width={64} height={64} />
        </span>
        <span className="bs-network-spark">✦</span>
      </div>
      <div className="bs-summary-body">
        <span className="ws-eyebrow">ASÍ VA TU NEGOCIO</span>
        <h2>{name.trim() || "Tu nuevo negocio"}</h2>
        <p>{categoryText || "Una idea con mucho por conectar."}</p>
        <div className="bs-progress-track" aria-hidden="true">
          <span style={{ width: `${(completed / 3) * 100}%` }} />
        </div>
        <p className="bs-progress-label">
          <span>Configuración</span>
          <strong>{completed} de 3 pasos</strong>
        </p>
        <ul className="bs-summary-list">
          <li>
            <span>Identidad del negocio</span>
            <b className={identityReady ? "is-ready" : undefined}>{identityReady ? "Lista" : "Pendiente"}</b>
          </li>
          <li>
            <span>Módulos elegidos</span>
            <b className={modulesReviewed || modules.length > 0 ? "is-ready" : undefined}>
              {modules.length} de {MODULES.length}
            </b>
          </li>
          <li>
            <span>Jefe de negocio</span>
            <b className={bossName ? "is-ready" : undefined}>{bossName ?? "Por asignar"}</b>
          </li>
        </ul>
      </div>
      <div className="bs-summary-brand">
        <span />
        Conecta. Comparte. Crece.
      </div>
    </aside>
  );
}
