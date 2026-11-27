import { observer } from "mobx-react-lite";
import { useId, useMemo, useState } from "react";
import { categoryLabel, type CategoryId } from "@/modules/businesses";
import type { AccessGrant } from "../api/businessAccessApi";
import { useFocusHeading } from "../hooks/useFocusHeading";
import { adminAccessStore } from "../stores/adminAccess.store";
import { PickerHeroArt } from "./PickerHeroArt";

type ChoiceStatus = "idle" | "loading" | "success";

interface BusinessGroup {
  businessId: string;
  businessName: string;
  categoryLabel: string;
  adminAccess: AccessGrant | null;
  operatorAccesses: AccessGrant[];
  totalCount: number;
}

/**
 * Step 4, only for people with more than one access: a business in a role, just the ones the server authorized.
 * Full-screen asymmetric 2-column Access Portal (distinct from /business/setup):
 * - Left rail: session identity + hierarchical NECTO flat-editorial vector art.
 * - Right stage: businesses grouped by businessId with clear Parent (Administrador) -> Child (Operador) nesting.
 */
export const BusinessPicker = observer(() => {
  const store = adminAccessStore;
  const headingRef = useFocusHeading();
  const baseId = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<"admin" | "operator" | null>(null);
  const [instantFocus, setInstantFocus] = useState(false);
  const [choiceStatus, setChoiceStatus] = useState<ChoiceStatus>("idle");

  const groups = useMemo<BusinessGroup[]>(() => {
    const map = new Map<string, BusinessGroup>();

    for (const access of store.accesses) {
      let group = map.get(access.businessId);
      if (!group) {
        group = {
          businessId: access.businessId,
          businessName: access.businessName,
          categoryLabel: categoryLabel(access.category as CategoryId, access.categoryOther),
          adminAccess: null,
          operatorAccesses: [],
          totalCount: 0,
        };
        map.set(access.businessId, group);
      }
      if (access.role === "admin") {
        group.adminAccess = access;
      } else {
        group.operatorAccesses.push(access);
      }
      group.totalCount += 1;
    }

    return Array.from(map.values());
  }, [store.accesses]);

  const hasAnyAdmin = groups.some((g) => g.adminAccess !== null);
  const totalOperatorCount = groups.reduce((acc, g) => acc + g.operatorAccesses.length, 0);

  const selectedRole = selectedKey
    ? (store.accesses.find((a) => a.key === selectedKey)?.role ?? null)
    : null;

  const handleSelect = async (key: string) => {
    if (store.busy || choiceStatus !== "idle") return;
    setSelectedKey(key);
    setChoiceStatus("loading");
    try {
      const minSpin = new Promise((resolve) => setTimeout(resolve, 350));
      await Promise.all([store.openAccess(key), minSpin]);
      setChoiceStatus("success");
    } catch {
      setSelectedKey(null);
      setChoiceStatus("idle");
    }
  };

  return (
    <section
      className="np-portal"
      data-instant-focus={instantFocus || undefined}
      aria-labelledby={`${baseId}-title`}
    >
      {/* LEFT RAIL — Identity, Context & Hierarchical NECTO Flat Editorial Vector */}
      <aside className="np-rail">
        <div className="np-rail-head">
          <span className="np-eyebrow">
            <i aria-hidden="true" />
            <span>TUS ESPACIOS EN NECTO</span>
          </span>

          <h1 id={`${baseId}-title`} ref={headingRef} tabIndex={-1} className="np-title">
            ¿Dónde comenzamos<span>?</span>
          </h1>

          <p className="np-subtitle">
            Elige si entras a administrar el negocio completo o directo a operar un módulo asignado.
          </p>

          {store.email && (
            <div className="np-account-row">
              <div className="np-email-pill">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <span>{store.email}</span>
              </div>
              <button
                type="button"
                className="np-switch-account-btn"
                disabled={store.busy || choiceStatus !== "idle"}
                onClick={() => void store.leave("Ingresa el correo de la cuenta con la que quieres continuar.")}
              >
                Usar otra cuenta
              </button>
            </div>
          )}
        </div>

        <div className="np-rail-art">
          <PickerHeroArt
            activeRole={selectedRole ?? hoveredRole}
            hasAdmin={hasAnyAdmin}
            operatorCount={totalOperatorCount}
          />
        </div>

        <p className="np-picker-note">
          Esta selección solo aparece cuando tienes más de un acceso (por negocio o por rol).
        </p>
      </aside>

      {/* RIGHT STAGE — Business-Grouped Parent (Admin) -> Subordinate Children (Operators) */}
      <div className="np-stage">
        {groups.map((group) => {
          const admin = group.adminAccess;
          const adminSelected = admin ? selectedKey === admin.key : false;
          const adminDimmed = selectedKey !== null && !adminSelected;
          const adminStatus = adminSelected ? choiceStatus : "idle";

          return (
            <article key={group.businessId} className="np-biz-group" aria-label={group.businessName}>
              {/* Business Identity Header */}
              <header className="np-biz-header">
                <div className="np-biz-id">
                  <span className="np-biz-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 21h18M4 9v12M20 9v12M3 9l2-5h14l2 5M9 21v-6h6v6" />
                    </svg>
                  </span>
                  <div className="np-biz-copy">
                    <h2 className="np-biz-name">{group.businessName}</h2>
                    <span className="np-biz-category">{group.categoryLabel}</span>
                  </div>
                </div>

                <span className="np-biz-count">
                  {group.totalCount} {group.totalCount === 1 ? "acceso" : "accesos"}
                </span>
              </header>

              {/* LEVEL 1 — PARENT ACCESS: Business Administrator */}
              {admin && (
                <button
                  type="button"
                  className="np-parent-card"
                  data-active={(selectedKey === admin.key || hoveredRole === "admin") || undefined}
                  data-dimmed={adminDimmed || undefined}
                  data-status={adminStatus}
                  aria-label={`Entrar a ${group.businessName} como administrador`}
                  disabled={store.busy || choiceStatus !== "idle"}
                  onMouseEnter={() => {
                    setInstantFocus(false);
                    setHoveredRole("admin");
                  }}
                  onMouseLeave={() => setHoveredRole(null)}
                  onFocus={() => {
                    setInstantFocus(true);
                    setHoveredRole("admin");
                  }}
                  onBlur={() => setHoveredRole(null)}
                  onClick={() => void handleSelect(admin.key)}
                >
                  <div className="np-parent-main">
                    <div className="np-parent-badges">
                      <span className="np-role-pill is-admin">
                        <i aria-hidden="true" />
                        <span>Administrador</span>
                      </span>
                      <span className="np-parent-scope">Acceso principal del negocio</span>
                    </div>

                    <h3 className="np-parent-title">Gestión y Configuración</h3>
                    <p className="np-parent-desc">
                      Control completo del negocio: datos base, horarios, catálogo, equipo y todos los módulos.
                    </p>
                  </div>

                  <div className="np-parent-action">
                    <span className="np-parent-cta">
                      {adminStatus === "loading" ? (
                        <>
                          <svg viewBox="0 0 24 24" className="na-action-spinner np-btn-icon" aria-hidden="true">
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeDasharray="14 42"
                              fill="none"
                            />
                          </svg>
                          <span>Ingresando…</span>
                        </>
                      ) : adminStatus === "success" ? (
                        <span>Listo ✓</span>
                      ) : (
                        <>
                          <span>Administrar negocio</span>
                          <span className="np-arrow" aria-hidden="true">→</span>
                        </>
                      )}
                    </span>
                  </div>
                </button>
              )}

              {/* LEVEL 2 — SUBORDINATE CHILD ACCESSES: Module Operators */}
              {group.operatorAccesses.length > 0 && (
                <div className="np-children-branch" data-has-parent={Boolean(admin) || undefined}>
                  <div className="np-children-head">
                    <span className="np-children-kicker">
                      {admin ? (
                        <>
                          <strong>Módulos subordinados</strong> · Acceso directo de operador
                        </>
                      ) : (
                        <strong>Módulos asignados como operador</strong>
                      )}
                    </span>
                  </div>

                  <div
                    className="np-children-grid"
                    data-count={group.operatorAccesses.length === 1 ? "single" : "multi"}
                  >
                    {group.operatorAccesses.map((access) => {
                      const isPedidos = access.modules[0] === "pedidos";
                      const isSelected = selectedKey === access.key;
                      const isDimmed = selectedKey !== null && !isSelected;
                      const status = isSelected ? choiceStatus : "idle";

                      const roleBadge = isPedidos ? "Operador · Pedidos" : "Operador · Turnos";
                      const title = isPedidos ? "Gestión de Pedidos" : "Atención y Turnos";
                      const desc = isPedidos
                        ? "Confirmación, preparación y despacho de pedidos."
                        : "Control de filas, llamado de tickets y atención.";

                      return (
                        <button
                          key={access.key}
                          type="button"
                          className="np-child-card"
                          data-dimmed={isDimmed || undefined}
                          data-status={status}
                          aria-label={`Entrar a ${group.businessName} como ${
                            isPedidos ? "operador de Pedidos" : "operador de Turnos"
                          }`}
                          disabled={store.busy || choiceStatus !== "idle"}
                          onMouseEnter={() => {
                            setInstantFocus(false);
                            setHoveredRole("operator");
                          }}
                          onMouseLeave={() => setHoveredRole(null)}
                          onFocus={() => {
                            setInstantFocus(true);
                            setHoveredRole("operator");
                          }}
                          onBlur={() => setHoveredRole(null)}
                          onClick={() => void handleSelect(access.key)}
                        >
                          <div className="np-child-top">
                            <span className="np-child-icon" aria-hidden="true">
                              {isPedidos ? (
                                <svg viewBox="0 0 24 24">
                                  <path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24">
                                  <path d="M8 5h12M8 12h12M8 19h12" />
                                  <circle cx="3.5" cy="5" r="1" />
                                  <circle cx="3.5" cy="12" r="1" />
                                  <circle cx="3.5" cy="19" r="1" />
                                </svg>
                              )}
                            </span>

                            <span className="np-role-pill is-operator">
                              <i aria-hidden="true" />
                              <span>{roleBadge}</span>
                            </span>
                          </div>

                          <div className="np-child-body">
                            <h3 className="np-child-title">{title}</h3>
                            <p className="np-child-desc">{desc}</p>
                          </div>

                          <div className="np-child-foot">
                            <span className="np-child-cta">
                              {status === "loading"
                                ? "Ingresando…"
                                : status === "success"
                                  ? "Listo"
                                  : isPedidos
                                    ? "Operar Pedidos"
                                    : "Operar Turnos"}
                            </span>

                            <span className="np-child-arrow" aria-hidden="true">
                              {status === "loading" ? (
                                <svg viewBox="0 0 24 24" className="na-action-spinner">
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeDasharray="14 42"
                                    fill="none"
                                  />
                                </svg>
                              ) : status === "success" ? (
                                <svg viewBox="0 0 24 24" className="na-action-check">
                                  <circle cx="12" cy="12" r="10" fill="#97D6DF" stroke="#190088" strokeWidth="1.5" />
                                  <path
                                    d="m8 12 3 3 5-6"
                                    stroke="#190088"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                  />
                                </svg>
                              ) : (
                                "→"
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
});
