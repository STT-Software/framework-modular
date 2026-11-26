import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { adminAccessStore } from "@/modules/business-access";
import { BusinessAppShell, Empty, PageHeading, activityText, type IconName, type NavItem } from "@/modules/business-dashboard";
import type { OperatorViewId } from "../../types";
import { operationApi } from "../api/operationApi";
import { useRemote } from "../hooks/useRemote";
import { operationStore } from "../stores/operation.store";
import { SECTION_VIEW, VIEW_LABEL, VIEW_SECTION } from "../types";
import { BoardSection } from "./BoardSection";
import { CreateSection, CreatedSection } from "./CreateSection";
import { DashboardSection, base } from "./DashboardSection";
import { DisplaySection } from "./DisplaySection";
import { QueuesSection } from "./QueuesSection";
import { SurveysSection } from "./SurveysSection";
import { TeamSection } from "./TeamSection";
import { TicketsSection } from "./TicketsSection";
const VIEW_ICON: Record<OperatorViewId, IconName> = { home: "grid", "my-turns": "tickets", "create-turn": "plus", queues: "queue", surveys: "star" };
const ORDER: OperatorViewId[] = ["home", "my-turns", "create-turn", "queues", "surveys"];
const TITLES: Record<string, string> = {
  dashboard: "Inicio",
  tickets: "Mis turnos",
  create: "Crear turno",
  created: "Turno creado",
  queues: "Filas",
  board: "Fila",
  surveys: "Encuestas",
  team: "Operadores",
  display: "Pantalla de sala",
};
/** Por qué la persona no puede entrar, dicho sin dar más detalle del necesario. */
function deniedText(reason: string | null): string {
  if (reason === "operator-not-operable") return "Tu acceso de operador todavía no está activo. Pide al administrador que lo revise.";
  if (reason === "revoked") return "Tu acceso a Turnos cambió mientras estabas aquí. Si todavía deberías tenerlo, vuelve a entrar con tu código.";
  return "Necesitas una asignación vigente para continuar.";
}
/**
 * Las pantallas de Turnos en funcionamiento (`/business/app/:businessId/turnos/:section/:id`): Inicio, Mis turnos, Crear turno, Filas (y el
 * tablero de cada una), Encuestas y, solo para el administrador, Operadores y Pantalla de sala. Es la misma sesión de `business-access`; las
 * vistas y filas que ve cada persona las dice el servidor, que vuelve a decidir en cada petición y avisa por el canal en vivo si cambian.
 */
const OperationPage = observer(() => {
  const { businessId = "", section, id } = useParams();
  const navigate = useNavigate();
  const store = operationStore;
  useEffect(() => {
    void store.load(businessId);
    return () => store.reset();
  }, [businessId, store]);
  useEffect(() => {
    if (store.status === "signed-out") navigate("/business/access", { replace: true });
  }, [store.status, navigate]);
  const activity = useRemote(() => store.run((token, role, id2) => operationApi.activity(token, role, id2, 8)), [], store.status === "ready" && store.can("home"));
  if (store.status === "loading" || store.status === "signed-out") {
    return (
      <section className="nd-root" aria-busy="true" aria-label="Cargando Turnos">
        <p className="nd-muted" style={{ margin: "auto" }}>
          Cargando Turnos…
        </p>
      </section>
    );
  }
  if (store.status !== "ready") {
    return (
      <section className="nd-root" aria-label="Turnos">
        <main className="nd-main" style={{ margin: "auto", maxWidth: 560 }}>
          <Empty
            title={store.status === "denied" ? "Un espacio a tu medida." : "No pudimos abrir Turnos"}
            text={store.status === "denied" ? deniedText(store.deniedReason) : "Revisa tu conexión e inténtalo de nuevo."}
            action={
              <Link className="nd-primary" to="/business/access">
                Volver al acceso
              </Link>
            }
          />
        </main>
      </section>
    );
  }
  const admin = store.isAdmin;
  const firstSection = admin ? "dashboard" : store.firstView ? VIEW_SECTION[store.firstView] : null;
  if (!section) return firstSection ? <Navigate to={base(businessId, firstSection)} replace /> : <NoViews />;
  const required = SECTION_VIEW[section];
  const known = required !== undefined;
  const allowed = known && (required === "admin" ? admin : store.can(required));
  const signOut = async () => {
    await adminAccessStore.leave("Cerraste sesión.");
    navigate("/business/access", { replace: true });
  };
  const nav: NavItem[] = [
    ...ORDER.filter((view) => store.can(view)).map((view) => {
      const target = VIEW_SECTION[view];
      return {
        to: base(businessId, target),
        label: VIEW_LABEL[view].label,
        icon: VIEW_ICON[view],
        current: section === target || (view === "queues" && section === "board") || (view === "create-turn" && section === "created"),
        count: view === "queues" ? store.queues.length : undefined,
      };
    }),
    ...(admin ? [{ to: base(businessId, "team"), label: "Operadores", icon: "users" as IconName, current: section === "team" }] : []),
  ];
  const content = !known ? null : !allowed ? <NotAllowed first={firstSection} businessId={businessId} /> : <Section section={section} id={id} />;
  return (
    <BusinessAppShell
      businessId={businessId}
      businessName={store.businessName}
      businessSubtitle="Módulo de Turnos"
      navTitle="TURNOS"
      nav={nav}
      homeLink={admin ? { to: `/business/app/${businessId}`, label: "Mi negocio" } : undefined}
      logoTo={admin ? `/business/app/${businessId}` : base(businessId, firstSection ?? "dashboard")}
      person={{ name: store.personName, email: adminAccessStore.email, roleLabel: admin ? "Administrador del negocio" : "Operador · Turnos", isAdmin: admin }}
      crumbs={admin ? [{ label: "Mi negocio", href: `/business/app/${businessId}` }, { label: "Turnos", href: base(businessId, "dashboard") }, { label: TITLES[section] ?? "Turnos" }] : [{ label: "Turnos", href: base(businessId, firstSection ?? "dashboard") }, { label: TITLES[section] ?? "Turnos" }]}
      settingsTo={admin ? `/business/turnos/${businessId}/profile` : undefined}
      activity={(activity.data ?? []).map((entry) => ({ text: activityText(entry.type, entry.ticket.code, entry.queue.name, entry.automatic), at: entry.at }))}
      live={store.live}
      onSignOut={() => void signOut()}
      documentTitle={TITLES[section] ?? "Turnos"}
    >
      {content ?? <Navigate to={base(businessId, firstSection ?? "dashboard")} replace />}
    </BusinessAppShell>
  );
});
function Section({ section, id }: { section: string; id: string | undefined }) {
  switch (section) {
    case "dashboard":
      return <DashboardSection />;
    case "tickets":
      return <TicketsSection />;
    case "queues":
      return <QueuesSection />;
    case "board":
      return <BoardSection queueId={id} />;
    case "create":
      return <CreateSection />;
    case "created":
      return <CreatedSection ticketId={id} />;
    case "surveys":
      return <SurveysSection />;
    case "team":
      return <TeamSection />;
    case "display":
      return <DisplaySection />;
    default:
      return null;
  }
}
function NotAllowed({ first, businessId }: { first: string | null; businessId: string }) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeading eyebrow="ACCESO · TURNOS" title="Un espacio a tu medida." description="Este acceso no tiene permiso para abrir la vista solicitada." />
      <div id="nd-content">
        <Empty
          title="Esta sección no está habilitada"
          text="Pide al administrador que revise tus vistas y filas asignadas."
          action={
            first ? (
              <button type="button" className="nd-primary" onClick={() => navigate(base(businessId, first))}>
                Ir a mi módulo
              </button>
            ) : undefined
          }
        />
      </div>
    </>
  );
}
function NoViews() {
  return (
    <section className="nd-root" aria-label="Turnos">
      <main className="nd-main" style={{ margin: "auto", maxWidth: 560 }}>
        <Empty title="Acceso pendiente" text="Todavía no tienes vistas habilitadas en Turnos. Pide al administrador que revise tu asignación." action={<Link className="nd-primary" to="/business/access">Volver al acceso</Link>} />
      </main>
    </section>
  );
}
export default OperationPage;
