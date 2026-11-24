import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { toastStore } from "../stores/toast.store";
import "../styles/business-app.css";
import { AppDialog } from "./AppDialog";
import type { IconName } from "./icons";
import { Badge, Icon, InfoBox, elapsed, initials } from "./ui";
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
  breadcrumb: ReactNode;
  /** Muestra «Configuración» (solo el administrador) y a dónde lleva. */
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
type Panel = null | "search" | "notifications" | "help" | "account";
/**
 * El marco de la aplicación del negocio (referencia `nd-`): navegación lateral (se contrae, y en el móvil se abre encima), barra superior con
 * búsqueda de secciones (⌘/Ctrl + K), actividad reciente, tema y cuenta, y el aviso breve. Lo usan el dashboard general y las pantallas
 * de Turnos; cada una pone dentro su encabezado (`PageHeading`) y su contenido.
 */
export const BusinessAppShell = observer((props: BusinessAppShellProps) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLElement>(null);
  const mobile = () => window.matchMedia("(max-width: 760px)").matches;
  // Cada pantalla entra con su animación (se apaga con `prefers-reduced-motion`).
  const { documentTitle } = props;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.remove("nd-motion");
    void root.offsetWidth;
    root.classList.add("nd-motion");
  }, [documentTitle]);
  useEffect(() => setMobileOpen(false), [documentTitle]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => toastStore.clear(), []);
  const toggleMenu = () => (mobile() ? setMobileOpen((open) => !open) : setCollapsed((value) => !value));
  const expanded = mobile() ? mobileOpen : !collapsed;
  const searchList = [...(props.homeLink ? [{ to: props.homeLink.to, label: props.homeLink.label, icon: "building" as IconName }] : []), ...props.nav];
  const go = (to: string) => {
    setPanel(null);
    navigate(to);
  };
  return (
    <section ref={rootRef} className={`nd-root${collapsed ? " nd-collapsed" : ""}${mobileOpen ? " nd-menu-open" : ""}`} aria-label="Mi negocio en Necto">
      <PageMeta title={`Necto · ${documentTitle}`} description="Tu negocio en Necto." />
      <button type="button" className="nd-mobile-scrim" aria-label="Cerrar navegación" hidden={!mobileOpen} onClick={() => setMobileOpen(false)} />
      <aside className="nd-sidebar" id="nd-sidebar" aria-label="Navegación del negocio">
        <Link className="nd-logo" to={props.logoTo} aria-label="Necto, inicio">
          <NectoLogo width={161} height={23} />
        </Link>
        <div className="nd-sidebar-business">
          <span className="nd-business-avatar">{initials(props.businessName)}</span>
          <div>
            <strong>{props.businessName}</strong>
            <small>{props.businessSubtitle}</small>
          </div>
        </div>
        <span className="nd-nav-eyebrow">{props.navTitle}</span>
        <nav aria-label="Secciones disponibles">
          {props.homeLink ? (
            <Link className="nd-nav-link" to={props.homeLink.to}>
              <Icon name="building" />
              {props.homeLink.label}
            </Link>
          ) : null}
          {props.nav.map((item) => (
            <Link key={item.to} className="nd-nav-link" to={item.to} aria-current={item.current ? "page" : undefined}>
              <Icon name={item.icon} />
              {item.label}
              {item.count !== undefined ? <span className="nd-nav-count">{item.count}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="nd-sidebar-bottom">
          {props.settingsTo ? (
            <button type="button" className="nd-nav-link" onClick={() => navigate(props.settingsTo as string)}>
              <Icon name="settings" wrap />
              Configuración
            </button>
          ) : null}
          <button type="button" className="nd-nav-link" onClick={() => setPanel("help")}>
            <Icon name="help" wrap />
            Ayuda y soporte
          </button>
          <button type="button" className="nd-nav-link" onClick={props.onSignOut}>
            <Icon name="logout" wrap />
            Cerrar sesión
          </button>
          <div className="nd-sidebar-person">
            <span className="nd-avatar">{initials(props.person.name)}</span>
            <div>
              <strong>{props.person.name}</strong>
              <small>{props.person.roleLabel}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="nd-workspace">
        <header className="nd-topbar">
          <div className="nd-topbar-start">
            <button type="button" className="nd-icon-button" aria-label={mobile() ? "Abrir navegación" : collapsed ? "Expandir navegación" : "Contraer navegación"} aria-expanded={expanded} aria-controls="nd-sidebar" onClick={toggleMenu}>
              <Icon name="menu" wrap />
            </button>
            <Link className="nd-mobile-brand" to={props.logoTo} aria-label="Necto, inicio">
              <NectoLogo variant="mark" width={23} height={23} />
            </Link>
            <div className="nd-breadcrumb">{props.breadcrumb}</div>
          </div>
          <div className="nd-topbar-actions">
            <button type="button" className="nd-search-button" onClick={() => setPanel("search")}>
              <Icon name="search" wrap />
              <span>Ir a una sección</span>
              <kbd>⌘ K</kbd>
            </button>
            <button type="button" className="nd-icon-button nd-notification-button" aria-label="Ver actividad reciente" onClick={() => setPanel("notifications")}>
              <Icon name="bell" wrap />
              {props.activity && props.activity.length > 0 ? <i /> : null}
            </button>
            <ThemeIconButton className="nd-icon-button" />
            <button type="button" className="nd-topbar-avatar" aria-label="Ver mi perfil" onClick={() => setPanel("account")}>
              {initials(props.person.name)}
            </button>
          </div>
        </header>
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
      </div>
      <p className="nd-toast" role="status" aria-live="polite" hidden={!toastStore.message}>
        {toastStore.message}
      </p>
      <AppDialog open={panel === "search"} title="¿Dónde quieres continuar?" eyebrow="TUS SECCIONES DISPONIBLES" onClose={() => setPanel(null)}>
        <div className="nd-dialog-list">
          {searchList.map((item) => (
            <button key={item.to} type="button" onClick={() => go(item.to)}>
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
      </AppDialog>
      <AppDialog open={panel === "notifications"} title="Cada conexión deja una señal." eyebrow="ACTIVIDAD RECIENTE" onClose={() => setPanel(null)}>
        <ActivityList items={props.activity ?? []} />
      </AppDialog>
      <AppDialog open={panel === "help"} title="Conectamos contigo" eyebrow="AYUDA · NECTO" onClose={() => setPanel(null)}>
        <p className="nd-muted">El administrador prepara las filas y las vistas de cada operador. El operador entra directamente a su módulo, con las filas que le asignaron.</p>
        <InfoBox>Si algo no coincide con lo que esperas, pide al administrador de tu negocio que revise tu asignación.</InfoBox>
      </AppDialog>
      <AppDialog open={panel === "account"} title="Tu espacio en Necto" eyebrow="TU CUENTA" onClose={() => setPanel(null)}>
        <div className="nd-detail-person">
          <span className="nd-avatar">{initials(props.person.name)}</span>
          <div>
            <h3>{props.person.name}</h3>
            <p>{props.person.email}</p>
          </div>
        </div>
        <Badge color="purple">{props.person.roleLabel}</Badge>
        <InfoBox>{props.person.isAdmin ? "Puedes entrar a los módulos asignados y gestionar los accesos de tu equipo." : "Puedes usar únicamente las vistas y filas que te asignó el administrador."}</InfoBox>
      </AppDialog>
    </section>
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
