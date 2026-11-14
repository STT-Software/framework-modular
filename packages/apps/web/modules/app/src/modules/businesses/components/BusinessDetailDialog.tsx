import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { businessesApi } from "../api/businessesApi";
import { categoryLabel, CURRENCIES, displayId, initialsOf, MODULES, TIMEZONES } from "../catalog";
import { businessErrorMessage } from "../errors";
import type { Business } from "../types";
import { InvitationPanel } from "./InvitationPanel";
import { ModuleIcon } from "./ModuleIcon";
import { StatusBadge } from "./StatusBadge";

type Tab = "summary" | "modules" | "team";
const TABS: Tab[] = ["summary", "modules", "team"];
const TAB_LABEL: Record<Tab, string> = { summary: "Resumen", modules: "Módulos", team: "Equipo" };

interface BusinessDetailDialogProps {
  business: Business | null;
  onClose: () => void;
  onEdit: (business: Business) => void;
  /** Called with the business as the service returns it after pausing or resuming. */
  onChanged: (business: Business) => void;
  onAnnounce: (message: string) => void;
}

/** The full sheet of a business: summary, modules and team (with the state of the boss's invitation). */
export function BusinessDetailDialog({ business, onClose, onEdit, onChanged, onAnnounce }: BusinessDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const [tab, setTab] = useState<Tab>("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const businessId = business?.id ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (businessId && !dialog.open) {
      setTab("summary");
      setError(null);
      dialog.showModal();
    }
    if (!businessId && dialog.open) dialog.close();
  }, [businessId]);

  async function toggleState() {
    if (!business || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = business.status === "active" ? await businessesApi.pause(business.id) : await businessesApi.resume(business.id);
      onChanged(updated);
      onAnnounce(`${updated.name} ${updated.status === "paused" ? "está en pausa." : "está activo."}`);
    } catch (failure) {
      setError(businessErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function handleTabKey(event: KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next]);
    document.getElementById(`${baseId}-tab-${TABS[next]}`)?.focus();
  }

  const data: [string, string | null][] = business
    ? [
        ["Nombre comercial", business.name],
        ["Razón social", business.legalName],
        ["NIT / ID fiscal", business.taxId],
        ["Categoría", categoryLabel(business.category, business.categoryOther)],
        ["Teléfono de contacto", business.phone],
        ["Correo de asistencia", business.supportEmail],
        ["Dirección", business.address],
        ["Sitio web", business.website],
        ["Moneda principal", CURRENCIES.find((item) => item.value === business.currency)?.label ?? business.currency],
        ["Zona horaria", TIMEZONES.find((item) => item.value === business.timezone)?.label ?? business.timezone],
      ]
    : [];
  const selected = business ? MODULES.filter((module) => business.modules.includes(module.id)) : [];
  const tabCount: Partial<Record<Tab, number>> = { modules: selected.length, team: 1 };

  return (
    <dialog
      ref={dialogRef}
      className="bs-dialog bs-detail-dialog"
      aria-labelledby={`${baseId}-name`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      {business && (
        <>
          <header className="bs-detail-header">
            <div className="bs-detail-identity">
              <span className="bs-business-avatar" aria-hidden="true">
                {initialsOf(business.name).slice(0, 1)}
              </span>
              <div>
                <div className="bs-detail-title-row">
                  <h2 id={`${baseId}-name`}>{business.name}</h2>
                  <StatusBadge status={business.status} />
                </div>
                <p>
                  <span>{categoryLabel(business.category, business.categoryOther)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{displayId(business.id)}</span>
                </p>
              </div>
            </div>
            <button type="button" className="ws-icon-button" aria-label="Cerrar ficha" onClick={() => dialogRef.current?.close()}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="bs-detail-tabs" role="tablist" aria-label="Información del negocio">
            {TABS.map((name, index) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`${baseId}-tab-${name}`}
                aria-selected={tab === name}
                aria-controls={`${baseId}-panel-${name}`}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                {TAB_LABEL[name]}
                {tabCount[name] !== undefined && <span>{tabCount[name]}</span>}
              </button>
            ))}
          </div>
          <div className="bs-detail-body">
            <section id={`${baseId}-panel-summary`} role="tabpanel" aria-labelledby={`${baseId}-tab-summary`} tabIndex={0} hidden={tab !== "summary"}>
              <div className="bs-detail-intro">
                <span className="bs-detail-intro-mark" aria-hidden="true">
                  <NectoLogo variant="mark" width={64} height={64} />
                </span>
                <div>
                  <strong>Todo lo que conecta a tu negocio.</strong>
                  <p>Su identidad, su operación y las personas que lo hacen posible.</p>
                </div>
              </div>
              <h3>Información del negocio</h3>
              <dl className="bs-detail-data">
                {data.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className={value ? undefined : "is-empty"}>{value || "Sin registrar"}</dd>
                  </div>
                ))}
              </dl>
              {!business.summary.hasActivity && (
                <div className="bs-activity-empty">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20V4m0 16h17M8 15l4-4 4 2 5-7" />
                  </svg>
                  <div>
                    <strong>La historia apenas comienza</strong>
                    <p>La actividad y los indicadores aparecerán cuando el negocio empiece a operar.</p>
                  </div>
                </div>
              )}
            </section>
            <section id={`${baseId}-panel-modules`} role="tabpanel" aria-labelledby={`${baseId}-tab-modules`} tabIndex={0} hidden={tab !== "modules"}>
              <h3>Herramientas de este negocio</h3>
              <p className="bs-detail-description">Las funcionalidades que elegiste durante la configuración.</p>
              <div className="bs-detail-module-list">
                {selected.map((module) => (
                  <div className="bs-detail-module" key={module.id}>
                    <ModuleIcon module={module} />
                    <div>
                      <strong>{module.name}</strong>
                      <p>Módulo activado</p>
                    </div>
                  </div>
                ))}
              </div>
              {selected.length === 0 && (
                <p className="bs-detail-description">Este negocio aún no tiene módulos activados. Puedes elegirlos desde Editar configuración.</p>
              )}
            </section>
            <section id={`${baseId}-panel-team`} role="tabpanel" aria-labelledby={`${baseId}-tab-team`} tabIndex={0} hidden={tab !== "team"}>
              <h3>El equipo empieza aquí</h3>
              <p className="bs-detail-description">El jefe de negocio es el responsable de su operación.</p>
              <div className="bs-leader-assigned">
                <div className="bs-person-row">
                  <span className="bs-person-avatar" aria-hidden="true">
                    {initialsOf(business.boss.name)}
                  </span>
                  <div>
                    <strong>{business.boss.name}</strong>
                    <span>{business.boss.email}</span>
                  </div>
                </div>
                <div className="bs-detail-team-foot">
                  <span className="bs-ok-badge">Jefe de negocio</span>
                  <span>Acceso con correo + OTP</span>
                </div>
                {tab === "team" && <InvitationPanel business={business} />}
              </div>
            </section>
          </div>
          {error && (
            <p className="bs-error" role="alert" style={{ padding: "0 30px 12px", margin: 0 }}>
              {error}
            </p>
          )}
          <footer className="bs-detail-footer">
            <button type="button" className="bs-text-button" onClick={toggleState} disabled={busy}>
              {busy ? "Guardando…" : business.status === "paused" ? "Reanudar negocio" : "Pausar negocio"}
            </button>
            <button
              type="button"
              className="ws-primary"
              onClick={() => {
                dialogRef.current?.close();
                onEdit(business);
              }}
            >
              Editar configuración <span aria-hidden="true">↗</span>
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
