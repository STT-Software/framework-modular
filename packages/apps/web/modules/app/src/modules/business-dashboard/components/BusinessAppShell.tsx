import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BaseAppShell } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { WorkspaceSupportWidget } from "@/modules/workspace";
import { toastStore } from "../stores/toast.store";
import "../styles/business-app.css";
import { AppDialog } from "./AppDialog";
import { BusinessSidebar, type SidebarItem } from "./BusinessSidebar";
import { BusinessTopbar } from "./BusinessTopbar";
import type { IconName } from "./icons";
import { Icon, elapsed } from "./ui";
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  current?: boolean;
  count?: number;
}
export interface ActivityItem {
  text: string;
  at: string;
}
export interface BusinessAppShellProps {
  businessName: string;
  /** «Espacio de trabajo» en el dashboard general, «Módulo de Turnos» dentro de Turnos. */
  businessSubtitle: string;
  navTitle: string;
  nav: NavItem[];
  /** Un enlace suelto sobre la navegación (en Turnos, el administrador vuelve a «Mi negocio»). */
  homeLink?: { to: string; label: string };
  logoTo: string;
  person: { name: string; email: string; roleLabel: string; isAdmin: boolean };
  /** Del inicio a la pantalla actual; la última no lleva enlace. */
  crumbs: Array<{ label: string; href?: string }>;
  /** «Configuración» (solo el administrador) y a dónde lleva. */
  settingsTo?: string;
  /** Lo reciente que se ve en la campana. */
  activity?: ActivityItem[];
  /** Si la conexión en vivo está abierta. */
  live?: boolean;
  onSignOut: () => void;
  /** El título del documento, para el lector de pantalla y el historial. */
  documentTitle: string;
  children: ReactNode;
}
/**
 * El marco de la aplicación del negocio: el mismo del superadministrador (`BaseAppShell`: barra lateral flotante que se contrae a un riel,
 * barra superior flotante y panel), con la navegación del administrador o del operador. El contenido conserva el diseño de la referencia
 * (`nd-`): el panel lo envuelve en `.nd-root` (con `nd-embedded`, sin su propio marco). Lo usan el dashboard general y las pantallas de Turnos.
 */
export const BusinessAppShell = observer((props: BusinessAppShellProps) => {
  const [activityOpen, setActivityOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Cada pantalla entra con su animación (se apaga con `prefers-reduced-motion`).
  const { documentTitle } = props;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.remove("nd-motion");
    void root.offsetWidth;
    root.classList.add("nd-motion");
  }, [documentTitle]);
  useEffect(() => () => toastStore.clear(), []);
  const accountItems: SidebarItem[] = props.settingsTo ? [{ to: props.settingsTo, label: "Configuración", icon: "settings" }] : [];
  return (
    <>
      <PageMeta title={`Necto · ${documentTitle}`} description="Tu negocio en Necto." />
      <BaseAppShell
        sidebar={
          <BusinessSidebar
            businessName={props.businessName}
            businessSubtitle={props.businessSubtitle}
            navTitle={props.navTitle}
            items={props.nav}
            homeLink={props.homeLink}
            logoTo={props.logoTo}
            accountItems={accountItems}
            onSignOut={props.onSignOut}
          />
        }
        header={
          <BusinessTopbar
            logoTo={props.logoTo}
            crumbs={props.crumbs}
            person={props.person}
            hasActivity={(props.activity?.length ?? 0) > 0}
            onOpenActivity={() => setActivityOpen(true)}
            onSignOut={props.onSignOut}
            accountLinks={[...(props.homeLink ? [{ to: props.homeLink.to, label: props.homeLink.label }] : []), ...accountItems.map((item) => ({ to: item.to, label: item.label }))]}
          />
        }
      >
        <div ref={rootRef} className="nd-root nd-embedded" aria-label="Mi negocio en Necto">
          <main className="nd-main" id="nd-main">
            {props.children}
          </main>
          <footer className="nd-footer">
            <span>© 2026 Necto · Conecta. Comparte. Crece.</span>
            <span>
              <i />
              {props.live === undefined ? "Datos reales de tu negocio" : props.live ? "En vivo" : "Se actualiza al recargar"}
            </span>
          </footer>
          <p className="nd-toast" role="status" aria-live="polite" hidden={!toastStore.message}>
            {toastStore.message}
          </p>
          <AppDialog open={activityOpen} title="Cada conexión deja una señal." eyebrow="ACTIVIDAD RECIENTE" onClose={() => setActivityOpen(false)}>
            <ActivityList items={props.activity ?? []} />
          </AppDialog>
        </div>
        <WorkspaceSupportWidget />
      </BaseAppShell>
    </>
  );
});
/** La lista de lo último que pasó, con «Hace n min». */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <p className="nd-muted">Aún no hay actividad en esta jornada.</p>;
  return (
    <div className="nd-activity-list">
      {items.map((item, index) => (
        <div key={`${item.at}-${index}`} className="nd-activity-item">
          <span className="nd-activity-symbol">
            <Icon name="activity" />
          </span>
          <div>
            <strong>{item.text}</strong>
            <p>{elapsed(item.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
/** El encabezado de cada pantalla: etiqueta, título, descripción y las acciones principales. */
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [title]);
  return (
    <div className="nd-page-heading">
      <div>
        <div className="nd-eyebrow">{eyebrow}</div>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        <p>{description}</p>
      </div>
      <div className="nd-page-actions">{actions}</div>
    </div>
  );
}
