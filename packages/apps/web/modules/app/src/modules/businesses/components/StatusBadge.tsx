import type { BusinessStatus } from "../types";

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return <span className={`bs-status-badge${status === "paused" ? " is-paused" : ""}`}>{status === "paused" ? "En pausa" : "Activo"}</span>;
}
